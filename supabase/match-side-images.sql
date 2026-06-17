-- Adds optional team/side artwork for any match side.
alter table public.match_sides
  add column if not exists image_url text;
