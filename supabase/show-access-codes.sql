-- Adds show-level access-code protection for picks entry.
--
-- SQL changes documented in this file:
-- 1. Adds access_code_required to public.shows so client flows can know
--    whether the selected show requires a code before picks entry.
-- 2. Adds access_code_hash to public.shows for server-side validation only.
--    Do not select this column from public browser queries.
-- 3. Adds a consistency check so protected shows must have a stored hash.
-- 4. Relies on the existing show update RLS policies for admin or
--    promotion-scoped manager writes.

alter table public.shows
  add column if not exists access_code_required boolean not null default false;

alter table public.shows
  add column if not exists access_code_hash text;

alter table public.shows
  drop constraint if exists shows_access_code_required_hash_chk;

alter table public.shows
  add constraint shows_access_code_required_hash_chk
  check (
    access_code_required = false
    or nullif(btrim(coalesce(access_code_hash, '')), '') is not null
  );
