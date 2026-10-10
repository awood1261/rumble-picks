-- Adds optional show-level planned match count for admin card planning.
--
-- SQL changes documented in this file:
-- 1. Adds planned_match_count to public.shows as flexible promoter intent.
--    This is not an enforced match limit and does not create placeholder
--    matches.
-- 2. Adds a bounded consistency check for practical UI counts.
-- 3. Relies on the existing show update RLS policies for global admins or
--    promotion-scoped managers/owners to update show planning metadata.

alter table public.shows
  add column if not exists planned_match_count integer;

alter table public.shows
  drop constraint if exists shows_planned_match_count_chk;

alter table public.shows
  add constraint shows_planned_match_count_chk
  check (
    planned_match_count is null
    or planned_match_count between 0 and 100
  );
