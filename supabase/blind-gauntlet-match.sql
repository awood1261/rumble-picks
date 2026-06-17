-- Adds Blind Gauntlet Match metadata, candidate pools, and result entrants.
alter table public.matches
  add column if not exists known_wrestler_id uuid references public.entrants(id) on delete set null;

alter table public.matches
  add column if not exists gauntlet_survival_result boolean;

alter table public.matches
  add column if not exists gauntlet_final_entrant_id uuid references public.entrants(id) on delete set null;

create table if not exists public.gauntlet_candidate_entrants (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  entrant_id uuid not null references public.entrants(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (match_id, entrant_id)
);

create table if not exists public.gauntlet_actual_entrants (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  entrant_id uuid not null references public.entrants(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (match_id, entrant_id)
);

alter table public.gauntlet_candidate_entrants enable row level security;
alter table public.gauntlet_actual_entrants enable row level security;

drop policy if exists "Gauntlet candidates readable by everyone" on public.gauntlet_candidate_entrants;
create policy "Gauntlet candidates readable by everyone"
  on public.gauntlet_candidate_entrants
  for select
  using (true);

drop policy if exists "Gauntlet candidates editable by admins" on public.gauntlet_candidate_entrants;
create policy "Gauntlet candidates editable by admins"
  on public.gauntlet_candidate_entrants
  for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

drop policy if exists "Gauntlet actuals readable by everyone" on public.gauntlet_actual_entrants;
create policy "Gauntlet actuals readable by everyone"
  on public.gauntlet_actual_entrants
  for select
  using (true);

drop policy if exists "Gauntlet actuals editable by admins" on public.gauntlet_actual_entrants;
create policy "Gauntlet actuals editable by admins"
  on public.gauntlet_actual_entrants
  for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));
