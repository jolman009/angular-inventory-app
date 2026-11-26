-- Vaulted: the database as it exists in production on 2026-11-26.
--
-- This file records the schema that was first set up by hand in the Supabase dashboard,
-- so the repository finally describes the real database (tables, rules, storage).
-- It was written from a read-only export of the live project.
--
-- It is safe to run on the existing project: every statement skips or replaces
-- what is already there. On a brand-new project it builds everything from scratch.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'media_type' and typnamespace = 'public'::regnamespace) then
    create type public.media_type as enum ('card', 'book', 'game', 'vinyl');
  end if;
  if not exists (select 1 from pg_type where typname = 'item_status' and typnamespace = 'public'::regnamespace) then
    create type public.item_status as enum ('owned', 'wishlist', 'for_sale', 'sold', 'lent');
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- items: one row per thing in someone's collection
-- ---------------------------------------------------------------------------
create table if not exists public.items (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type           public.media_type not null,
  title          text not null,
  status         public.item_status not null default 'owned',
  condition      text,
  purchase_price numeric,
  notes          text,
  details        jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  image_path     text,
  draft          boolean not null default false,
  constraint title_length      check (char_length(title) between 1 and 200),
  constraint notes_length      check (notes is null or char_length(notes) <= 5000),
  constraint price_nonnegative check (purchase_price is null or purchase_price >= 0),
  constraint details_is_object check (jsonb_typeof(details) = 'object')
);

alter table public.items enable row level security;

-- Each person can see and change only their own rows.
drop policy if exists "own items" on public.items;
create policy "own items" on public.items
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- scan_usage: how many photo scans each person used per day (for the daily limit)
-- Only the scan-item edge function touches it, using the service role.
-- RLS is on with no policies, so signed-in users can't read or change it.
-- ---------------------------------------------------------------------------
create table if not exists public.scan_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day     date not null default ((now() at time zone 'utc'))::date,
  count   integer not null default 0,
  primary key (user_id, day)
);

alter table public.scan_usage enable row level security;

-- Adds one scan for today and returns false once the daily limit is reached.
create or replace function public.claim_scan(p_user uuid, p_limit integer)
returns boolean
language plpgsql
set search_path to 'public'
as $$
declare
  new_count integer;
begin
  insert into scan_usage (user_id, day, count)
  values (p_user, (now() at time zone 'utc')::date, 1)
  on conflict (user_id, day)
  do update set count = scan_usage.count + 1
  where scan_usage.count < p_limit
  returning count into new_count;

  return new_count is not null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Storage: private photo bucket, one folder per person (<user id>/<file>)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('item-images', 'item-images', false)
on conflict (id) do nothing;

drop policy if exists "own folder access" on storage.objects;
create policy "own folder access" on storage.objects
  for all
  to authenticated
  using (bucket_id = 'item-images' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'item-images' and (storage.foldername(name))[1] = auth.uid()::text);
