-- Adds an optional per-show confidence-points toggle for match winner scoring.

alter table public.shows
  add column if not exists use_confidence_points boolean not null default false;
