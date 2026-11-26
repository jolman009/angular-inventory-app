-- Vaulted Pro: paid plans through Stripe.
--
-- What this adds:
--   1. subscriptions: one row per person who has ever started checkout. Only the server
--      (the Stripe webhook and billing functions, using the service role) writes to it.
--      People can read their own row, so the app can show their plan.
--   2. is_pro(user): true while someone's subscription is paid up (or in Stripe's retry window).
--   3. A rule on items: the free plan holds up to 100 items. Nothing is ever deleted;
--      people over the limit just can't add more until they upgrade.
--
-- Safe to run more than once.

-- ---------------------------------------------------------------------------
-- 1. subscriptions
-- ---------------------------------------------------------------------------
create table if not exists public.subscriptions (
  user_id                uuid primary key references auth.users (id) on delete cascade,
  stripe_customer_id     text not null unique,
  stripe_subscription_id text unique,
  -- Stripe's own status words: active, trialing, past_due, canceled, unpaid, incomplete, ...
  -- null until the first checkout is finished.
  status                 text,
  plan                   text check (plan is null or plan in ('monthly', 'yearly')),
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  updated_at             timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

drop policy if exists "read own subscription" on public.subscriptions;
create policy "read own subscription" on public.subscriptions
  for select
  to authenticated
  using (auth.uid() = user_id);

-- Reading is all the app needs. Every change comes from the server.
revoke all on table public.subscriptions from anon;
revoke insert, update, delete, truncate, trigger, references on table public.subscriptions from authenticated;
grant select on table public.subscriptions to authenticated;

-- ---------------------------------------------------------------------------
-- 2. is_pro: one place that decides who gets Pro features
-- ---------------------------------------------------------------------------
-- past_due counts as Pro so a failed card renewal doesn't lock someone out while
-- Stripe retries the payment. Once Stripe gives up, the status changes and Pro ends.
create or replace function public.is_pro(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from subscriptions
    where user_id = p_user
      and status in ('active', 'trialing', 'past_due')
  );
$$;

-- It takes any user id, so only the server may call it.
revoke execute on function public.is_pro(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Free plan item limit
-- ---------------------------------------------------------------------------
create or replace function public.enforce_item_limit()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  free_limit constant integer := 100;
  current_count integer;
begin
  if is_pro(new.user_id) then
    return new;
  end if;

  -- Two uploads at the same moment must not both slip past the limit,
  -- so handle one insert at a time for each person.
  perform pg_advisory_xact_lock(hashtext('item_limit:' || new.user_id::text));

  select count(*) into current_count from items where user_id = new.user_id;
  if current_count >= free_limit then
    -- The app looks for "ITEM_LIMIT" in this message to show the upgrade option.
    raise exception 'ITEM_LIMIT: The free plan holds up to % items.', free_limit
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke execute on function public.enforce_item_limit() from public, anon, authenticated;

drop trigger if exists items_free_limit on public.items;
create trigger items_free_limit
  before insert on public.items
  for each row
  execute function public.enforce_item_limit();
