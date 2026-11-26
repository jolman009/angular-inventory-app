-- Tightens access found during the 2026-11-26 schema review. Nothing here changes how
-- the app behaves for signed-in users; it removes powers no one should have.

-- 1. Signed-out visitors ("anon") never need the tables. Row rules already hid every
--    row from them, but they still held table-level rights, including TRUNCATE,
--    which row rules don't cover. Remove them.
revoke all on table public.items from anon;
revoke all on table public.scan_usage from anon;

-- 2. Signed-in users only need to read and change their own items.
--    TRUNCATE (empty the whole table), TRIGGER and REFERENCES aren't needed.
revoke truncate, trigger, references on table public.items from authenticated;

-- 3. scan_usage is only for the scan-item edge function (service role).
revoke all on table public.scan_usage from authenticated;

-- 4. claim_scan takes any user id, so only the server may call it.
--    New functions are callable by everyone unless revoked.
revoke execute on function public.claim_scan(uuid, integer) from public, anon, authenticated;

-- 5. Each person's collection is read newest-first. This index makes that fast
--    as collections grow, instead of scanning every row in the table.
create index if not exists items_user_created_idx
  on public.items (user_id, created_at desc, id);

-- 6. Photo uploads: the app shrinks photos to small JPEGs before uploading, so cap
--    files at 5 MB and accept image files only.
update storage.buckets
set file_size_limit = 5 * 1024 * 1024,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'item-images';
