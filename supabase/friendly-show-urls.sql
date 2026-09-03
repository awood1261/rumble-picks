-- Adds stable friendly URL slugs for promotions and shows.
alter table public.promotions
  add column if not exists slug text;

alter table public.shows
  add column if not exists slug text;

with normalized as (
  select
    id,
    coalesce(
      nullif(
        regexp_replace(
          regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g'),
          '(^-|-$)',
          '',
          'g'
        ),
        ''
      ),
      'promotion'
    ) as base_slug
  from public.promotions
),
ranked as (
  select
    id,
    base_slug,
    row_number() over (partition by base_slug order by id) as slug_rank
  from normalized
)
update public.promotions p
set slug = case
  when r.slug_rank = 1 then r.base_slug
  else r.base_slug || '-' || r.slug_rank
end
from ranked r
where p.id = r.id
  and (p.slug is null or btrim(p.slug) = '');

with normalized as (
  select
    id,
    promotion_id,
    coalesce(
      nullif(
        regexp_replace(
          regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g'),
          '(^-|-$)',
          '',
          'g'
        ),
        ''
      ),
      'show'
    ) as base_slug
  from public.shows
),
ranked as (
  select
    id,
    base_slug,
    row_number() over (
      partition by promotion_id, base_slug
      order by id
    ) as slug_rank
  from normalized
)
update public.shows s
set slug = case
  when r.slug_rank = 1 then r.base_slug
  else r.base_slug || '-' || r.slug_rank
end
from ranked r
where s.id = r.id
  and (s.slug is null or btrim(s.slug) = '');

alter table public.promotions
  drop constraint if exists promotions_slug_format_chk;

alter table public.promotions
  add constraint promotions_slug_format_chk
  check (slug is null or slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

alter table public.shows
  drop constraint if exists shows_slug_format_chk;

alter table public.shows
  add constraint shows_slug_format_chk
  check (slug is null or slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

create unique index if not exists promotions_slug_unique_idx
  on public.promotions (slug)
  where slug is not null;

create unique index if not exists shows_promotion_slug_unique_idx
  on public.shows (promotion_id, slug)
  where promotion_id is not null and slug is not null;
