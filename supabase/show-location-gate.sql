-- Adds optional per-show venue/geofence configuration for location-gated picks.
alter table public.shows
  add column if not exists requires_location_verification boolean not null default false;

alter table public.shows
  add column if not exists venue_name text;

alter table public.shows
  add column if not exists venue_address text;

alter table public.shows
  add column if not exists venue_latitude double precision;

alter table public.shows
  add column if not exists venue_longitude double precision;

alter table public.shows
  add column if not exists location_radius_meters integer;
