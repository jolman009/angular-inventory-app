-- Lets a signed-in user permanently delete their own account.
-- Called from the app as supabase.rpc('delete_user') (see ItemStore.deleteAccountAndData).
--
-- It deletes the user's items and their login in ONE transaction: if anything fails,
-- nothing is deleted. Photos are removed by the app first, through the Storage API,
-- because Supabase does not allow deleting storage files from SQL.
--
-- Assumes public.items has a user_id column holding the owner's auth user id.

create or replace function public.delete_user()
returns void
language plpgsql
security definer          -- runs with the function owner's rights, so it may delete from auth.users
set search_path = ''      -- every name below is schema-qualified; this blocks search_path tricks
as $$
declare
  uid uuid := auth.uid(); -- the id of whoever is calling, taken from their login token
begin
  if uid is null then
    raise exception 'You must be signed in to delete your account.';
  end if;

  delete from public.items where user_id = uid;
  delete from auth.users where id = uid;
end;
$$;

-- Only signed-in users may call it, and it can only ever delete the caller.
revoke all on function public.delete_user() from public, anon;
grant execute on function public.delete_user() to authenticated;
