-- Supabase schema for Rumble Picks MVP

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', new.email));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.profiles p where p.id = uid and p.is_admin = true
  );
$$;

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  starts_at timestamptz,
  rumble_gender text,
  status text not null default 'draft',
  roster_year integer,
  created_at timestamptz not null default now()
);

create table if not exists public.entrants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  promotion text,
  gender text,
  image_url text,
  roster_year integer,
  event_id uuid references public.events(id) on delete cascade,
  is_custom boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  kind text not null default 'match',
  status text not null default 'scheduled',
  winner_entrant_id uuid references public.entrants(id),
  created_at timestamptz not null default now()
);

create table if not exists public.rumble_entries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  entrant_id uuid not null references public.entrants(id) on delete cascade,
  entry_number integer,
  eliminated_by uuid references public.entrants(id),
  eliminated_at timestamptz,
  eliminations_count integer not null default 0,
  created_at timestamptz not null default now(),
  unique (event_id, entrant_id),
  unique (event_id, entry_number)
);

create table if not exists public.picks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, event_id)
);

create table if not exists public.scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  points integer not null default 0,
  breakdown jsonb,
  updated_at timestamptz not null default now(),
  unique (user_id, event_id)
);

alter table public.entrants
  add constraint if not exists entrants_gender_check
  check (gender is null or gender in ('men', 'women'));

alter table public.events
  add constraint if not exists events_rumble_gender_check
  check (rumble_gender is null or rumble_gender in ('men', 'women'));

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_picks_updated_at on public.picks;
create trigger set_picks_updated_at
  before update on public.picks
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_scores_updated_at on public.scores;
create trigger set_scores_updated_at
  before update on public.scores
  for each row execute procedure public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.entrants enable row level security;
alter table public.matches enable row level security;
alter table public.rumble_entries enable row level security;
alter table public.picks enable row level security;
alter table public.scores enable row level security;

-- Profiles: users can read/update their own profile; admins can read all.
create policy "Profiles are viewable by owner or admin"
  on public.profiles
  for select
  using (auth.uid() = id or public.is_admin(auth.uid()));

create policy "Profiles are viewable by authenticated users"
  on public.profiles
  for select
  using (auth.role() = 'authenticated');

create policy "Profiles are updateable by owner"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Public read access for event data; admin-only writes.
create policy "Events are viewable by everyone"
  on public.events
  for select
  using (true);

create policy "Events are modifiable by admins"
  on public.events
  for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

create policy "Entrants are viewable by everyone"
  on public.entrants
  for select
  using (true);

create policy "Entrants are modifiable by admins"
  on public.entrants
  for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

create policy "Custom entrants are insertable by authenticated users"
  on public.entrants
  for insert
  with check (
    auth.uid() is not null
    and is_custom = true
    and created_by = auth.uid()
    and event_id is not null
  );

create policy "Matches are viewable by everyone"
  on public.matches
  for select
  using (true);

create policy "Matches are modifiable by admins"
  on public.matches
  for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

create policy "Rumble entries are viewable by everyone"
  on public.rumble_entries
  for select
  using (true);

create policy "Rumble entries are modifiable by admins"
  on public.rumble_entries
  for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- Picks: user-owned, admin-readable.
create policy "Picks are viewable by owner or admin"
  on public.picks
  for select
  using (auth.uid() = user_id or public.is_admin(auth.uid()));

create policy "Picks are viewable by authenticated users"
  on public.picks
  for select
  using (auth.role() = 'authenticated');

create policy "Picks are insertable by owner"
  on public.picks
  for insert
  with check (auth.uid() = user_id);

create policy "Picks are updatable by owner"
  on public.picks
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Picks are deletable by owner"
  on public.picks
  for delete
  using (auth.uid() = user_id);

-- Scores: public leaderboard, admin writes.
create policy "Scores are viewable by everyone"
  on public.scores
  for select
  using (true);

create policy "Scores are modifiable by admins"
  on public.scores
  for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- Recalculate scores whenever rumble entries change.
create or replace function public.recalculate_scores_for_event(p_event_id uuid)
returns void
language plpgsql
as $$
begin
  with
  actual_entrants as (
    select entrant_id from public.rumble_entries where event_id = p_event_id
  ),
  final_four as (
    select entrant_id
    from public.rumble_entries
    where event_id = p_event_id
    order by eliminated_at desc nulls first
    limit 4
  ),
  winner as (
    select entrant_id
    from public.rumble_entries
    where event_id = p_event_id and eliminated_at is null
    limit 1
  ),
  entry_1 as (
    select entrant_id from public.rumble_entries
    where event_id = p_event_id and entry_number = 1
  ),
  entry_2 as (
    select entrant_id from public.rumble_entries
    where event_id = p_event_id and entry_number = 2
  ),
  entry_30 as (
    select entrant_id from public.rumble_entries
    where event_id = p_event_id and entry_number = 30
  ),
  max_elims as (
    select max(eliminations_count) as max_elims
    from public.rumble_entries
    where event_id = p_event_id
  ),
  top_elims as (
    select re.entrant_id
    from public.rumble_entries re
    cross join max_elims
    where re.event_id = p_event_id
      and max_elims.max_elims is not null
      and re.eliminations_count = max_elims.max_elims
  ),
  pick_rows as (
    select user_id, payload
    from public.picks
    where event_id = p_event_id
  ),
  pick_entrants as (
    select pr.user_id, count(*) as correct
    from pick_rows pr
    join lateral jsonb_array_elements_text(pr.payload->'entrants') as e(id) on true
    join actual_entrants a on a.entrant_id::text = e.id
    group by pr.user_id
  ),
  pick_final_four as (
    select pr.user_id, count(*) as correct
    from pick_rows pr
    join lateral jsonb_array_elements_text(pr.payload->'final_four') as f(id) on true
    join final_four ff on ff.entrant_id::text = f.id
    group by pr.user_id
  ),
  pick_winner as (
    select pr.user_id,
      case
        when (select count(*) from public.rumble_entries where event_id = p_event_id) >= 30
         and (select count(*) from public.rumble_entries where event_id = p_event_id and eliminated_at is null) = 1
         and pr.payload->>'winner' = (select entrant_id::text from winner)
        then 1 else 0
      end as correct
    from pick_rows pr
  ),
  pick_entry_1 as (
    select pr.user_id,
      case
        when pr.payload->>'entry_1' = (select entrant_id::text from entry_1 limit 1)
        then 1 else 0
      end as correct
    from pick_rows pr
  ),
  pick_entry_2 as (
    select pr.user_id,
      case
        when pr.payload->>'entry_2' = (select entrant_id::text from entry_2 limit 1)
        then 1 else 0
      end as correct
    from pick_rows pr
  ),
  pick_entry_30 as (
    select pr.user_id,
      case
        when pr.payload->>'entry_30' = (select entrant_id::text from entry_30 limit 1)
        then 1 else 0
      end as correct
    from pick_rows pr
  ),
  pick_most_elims as (
    select pr.user_id,
      case
        when pr.payload->>'most_eliminations' in (
          select entrant_id::text from top_elims
        )
        then 1 else 0
      end as correct
    from pick_rows pr
  ),
  score_calc as (
    select
      pr.user_id,
      coalesce(pe.correct, 0) as entrants_correct,
      coalesce(pf.correct, 0) as final_four_correct,
      coalesce(pw.correct, 0) as winner_correct,
      coalesce(p1.correct, 0) as entry_1_correct,
      coalesce(p2.correct, 0) as entry_2_correct,
      coalesce(p30.correct, 0) as entry_30_correct,
      coalesce(pme.correct, 0) as most_eliminations_correct
    from pick_rows pr
    left join pick_entrants pe on pe.user_id = pr.user_id
    left join pick_final_four pf on pf.user_id = pr.user_id
    left join pick_winner pw on pw.user_id = pr.user_id
    left join pick_entry_1 p1 on p1.user_id = pr.user_id
    left join pick_entry_2 p2 on p2.user_id = pr.user_id
    left join pick_entry_30 p30 on p30.user_id = pr.user_id
    left join pick_most_elims pme on pme.user_id = pr.user_id
  )
  insert into public.scores (user_id, event_id, points, breakdown, updated_at)
  select
    sc.user_id,
    p_event_id,
    (sc.entrants_correct * 1)
      + (sc.final_four_correct * 6)
      + (sc.winner_correct * 12)
      + (sc.entry_1_correct * 6)
      + (sc.entry_2_correct * 6)
      + (sc.entry_30_correct * 5)
      + (sc.most_eliminations_correct * 6) as points,
    jsonb_build_object(
      'entrants', sc.entrants_correct * 1,
      'final_four', sc.final_four_correct * 6,
      'winner', sc.winner_correct * 12,
      'entry_1', sc.entry_1_correct * 6,
      'entry_2', sc.entry_2_correct * 6,
      'entry_30', sc.entry_30_correct * 5,
      'most_eliminations', sc.most_eliminations_correct * 6
    ),
    now()
  from score_calc sc
  on conflict (user_id, event_id)
  do update set
    points = excluded.points,
    breakdown = excluded.breakdown,
    updated_at = excluded.updated_at;
end;
$$;

create or replace function public.handle_rumble_entries_score_recalc()
returns trigger
language plpgsql
as $$
begin
  perform public.recalculate_scores_for_event(coalesce(new.event_id, old.event_id));
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists rumble_entries_score_recalc on public.rumble_entries;
create trigger rumble_entries_score_recalc
  after insert or update or delete on public.rumble_entries
  for each row execute procedure public.handle_rumble_entries_score_recalc();
