-- Promotion-scoped promoter access.
--
-- SQL changes documented in this file:
-- 1. Adds promotion_members for super-admin approved promoter access.
-- 2. Adds promotion_roster_members for promotion-specific roster curation
--    from the existing global entrants catalog.
-- 3. Adds helper functions used by RLS to authorize promotion-, show-,
--    event-, match-, eliminator-, and review-link-scoped management writes.
-- 4. Updates admin-write RLS policies from global-admin-only to
--    super-admin-or-assigned-promotion-member where the table is scoped to a
--    promotion. Public fan-facing read policies are intentionally preserved.
-- 5. Keeps destructive submitted-pick/score deletion and canonical entrant
--    edits super-admin-only for this first version.

create table if not exists public.promotion_members (
  id uuid primary key default gen_random_uuid(),
  promotion_id uuid not null references public.promotions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint promotion_members_role_chk check (role in ('owner', 'manager'))
);

create unique index if not exists promotion_members_active_unique_idx
  on public.promotion_members (promotion_id, user_id)
  where revoked_at is null;

create index if not exists promotion_members_user_active_idx
  on public.promotion_members (user_id, promotion_id)
  where revoked_at is null;

create index if not exists promotion_members_promotion_active_idx
  on public.promotion_members (promotion_id, role)
  where revoked_at is null;

create table if not exists public.promotion_roster_members (
  id uuid primary key default gen_random_uuid(),
  promotion_id uuid not null references public.promotions(id) on delete cascade,
  entrant_id uuid not null references public.entrants(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  deactivated_at timestamptz,
  deactivated_by uuid references auth.users(id) on delete set null
);

create unique index if not exists promotion_roster_members_active_unique_idx
  on public.promotion_roster_members (promotion_id, entrant_id)
  where deactivated_at is null;

create index if not exists promotion_roster_members_promotion_active_idx
  on public.promotion_roster_members (promotion_id, entrant_id)
  where deactivated_at is null;

create index if not exists promotion_roster_members_entrant_idx
  on public.promotion_roster_members (entrant_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_promotion_members_updated_at on public.promotion_members;
create trigger set_promotion_members_updated_at
  before update on public.promotion_members
  for each row execute procedure public.set_updated_at();

create or replace function public.is_promotion_member(uid uuid, target_promotion_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.promotion_members pm
    where pm.user_id = uid
      and pm.promotion_id = target_promotion_id
      and pm.revoked_at is null
  );
$$;

create or replace function public.can_manage_promotion(uid uuid, target_promotion_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_admin(uid)
    or (
      target_promotion_id is not null
      and public.is_promotion_member(uid, target_promotion_id)
    );
$$;

create or replace function public.can_manage_show(uid uuid, target_show_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.shows s
    where s.id = target_show_id
      and public.can_manage_promotion(uid, s.promotion_id)
  );
$$;

create or replace function public.can_manage_event(uid uuid, target_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.events e
    join public.shows s on s.id = e.show_id
    where e.id = target_event_id
      and public.can_manage_promotion(uid, s.promotion_id)
  );
$$;

create or replace function public.can_manage_match(uid uuid, target_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.matches m
    left join public.shows s on s.id = m.show_id
    left join public.events e on e.id = m.event_id
    left join public.shows event_show on event_show.id = e.show_id
    where m.id = target_match_id
      and public.can_manage_promotion(
        uid,
        coalesce(s.promotion_id, event_show.promotion_id)
      )
  );
$$;

create or replace function public.can_manage_eliminator(uid uuid, target_eliminator_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.eliminators el
    join public.shows s on s.id = el.show_id
    where el.id = target_eliminator_id
      and public.can_manage_promotion(uid, s.promotion_id)
  );
$$;

create or replace function public.can_manage_show_review_link(uid uuid, target_link_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.show_review_links srl
    where srl.id = target_link_id
      and public.can_manage_promotion(uid, srl.promotion_id)
  );
$$;

alter table public.promotion_members enable row level security;
alter table public.promotion_roster_members enable row level security;

drop policy if exists "Promotion members are viewable by admins and scoped members"
  on public.promotion_members;
create policy "Promotion members are viewable by admins and scoped members"
  on public.promotion_members
  for select
  using (
    public.is_admin(auth.uid())
    or public.can_manage_promotion(auth.uid(), promotion_id)
  );

drop policy if exists "Promotion members are insertable by admins"
  on public.promotion_members;
create policy "Promotion members are insertable by admins"
  on public.promotion_members
  for insert
  with check (public.is_admin(auth.uid()));

drop policy if exists "Promotion members are updateable by admins"
  on public.promotion_members;
create policy "Promotion members are updateable by admins"
  on public.promotion_members
  for update
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

drop policy if exists "Promotion members are deletable by admins"
  on public.promotion_members;
create policy "Promotion members are deletable by admins"
  on public.promotion_members
  for delete
  using (public.is_admin(auth.uid()));

drop policy if exists "Promotion roster members are viewable by everyone"
  on public.promotion_roster_members;
create policy "Promotion roster members are viewable by everyone"
  on public.promotion_roster_members
  for select
  using (true);

drop policy if exists "Promotion roster members are insertable by scoped admins"
  on public.promotion_roster_members;
create policy "Promotion roster members are insertable by scoped admins"
  on public.promotion_roster_members
  for insert
  with check (public.can_manage_promotion(auth.uid(), promotion_id));

drop policy if exists "Promotion roster members are updateable by scoped admins"
  on public.promotion_roster_members;
create policy "Promotion roster members are updateable by scoped admins"
  on public.promotion_roster_members
  for update
  using (public.can_manage_promotion(auth.uid(), promotion_id))
  with check (public.can_manage_promotion(auth.uid(), promotion_id));

drop policy if exists "Promotion roster members are deletable by scoped admins"
  on public.promotion_roster_members;
create policy "Promotion roster members are deletable by scoped admins"
  on public.promotion_roster_members
  for delete
  using (public.can_manage_promotion(auth.uid(), promotion_id));

drop policy if exists "Promotions are modifiable by admins" on public.promotions;
drop policy if exists "Promotions are insertable by admins" on public.promotions;
create policy "Promotions are insertable by admins"
  on public.promotions
  for insert
  with check (public.is_admin(auth.uid()));

drop policy if exists "Promotions are updateable by scoped admins" on public.promotions;
create policy "Promotions are updateable by scoped admins"
  on public.promotions
  for update
  using (public.can_manage_promotion(auth.uid(), id))
  with check (public.can_manage_promotion(auth.uid(), id));

drop policy if exists "Promotions are deletable by admins" on public.promotions;
create policy "Promotions are deletable by admins"
  on public.promotions
  for delete
  using (public.is_admin(auth.uid()));

drop policy if exists "Shows are modifiable by admins" on public.shows;
drop policy if exists "Shows are modifiable by scoped admins" on public.shows;
create policy "Shows are modifiable by scoped admins"
  on public.shows
  for all
  using (public.can_manage_promotion(auth.uid(), promotion_id))
  with check (public.can_manage_promotion(auth.uid(), promotion_id));

drop policy if exists "Events are modifiable by admins" on public.events;
drop policy if exists "Events are modifiable by scoped admins" on public.events;
create policy "Events are modifiable by scoped admins"
  on public.events
  for all
  using (public.can_manage_event(auth.uid(), id))
  with check (public.can_manage_show(auth.uid(), show_id));

drop policy if exists "Show questions are modifiable by admins" on public.show_questions;
drop policy if exists "Show questions are modifiable by scoped admins" on public.show_questions;
create policy "Show questions are modifiable by scoped admins"
  on public.show_questions
  for all
  using (public.can_manage_show(auth.uid(), show_id))
  with check (public.can_manage_show(auth.uid(), show_id));

drop policy if exists "Eliminators are modifiable by admins" on public.eliminators;
drop policy if exists "Eliminators are modifiable by scoped admins" on public.eliminators;
create policy "Eliminators are modifiable by scoped admins"
  on public.eliminators
  for all
  using (public.can_manage_eliminator(auth.uid(), id))
  with check (public.can_manage_show(auth.uid(), show_id));

drop policy if exists "Eliminator entries are modifiable by admins" on public.eliminator_entries;
drop policy if exists "Eliminator entries are modifiable by scoped admins" on public.eliminator_entries;
create policy "Eliminator entries are modifiable by scoped admins"
  on public.eliminator_entries
  for all
  using (public.can_manage_eliminator(auth.uid(), eliminator_id))
  with check (public.can_manage_eliminator(auth.uid(), eliminator_id));

drop policy if exists "Eliminator eliminations are modifiable by admins" on public.eliminator_eliminations;
drop policy if exists "Eliminator eliminations are modifiable by scoped admins" on public.eliminator_eliminations;
create policy "Eliminator eliminations are modifiable by scoped admins"
  on public.eliminator_eliminations
  for all
  using (public.can_manage_eliminator(auth.uid(), eliminator_id))
  with check (public.can_manage_eliminator(auth.uid(), eliminator_id));

drop policy if exists "Entrants are modifiable by admins" on public.entrants;
drop policy if exists "Entrants are modifiable by admins only" on public.entrants;
create policy "Entrants are modifiable by admins only"
  on public.entrants
  for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

drop policy if exists "Matches are modifiable by admins" on public.matches;
drop policy if exists "Matches are modifiable by scoped admins" on public.matches;
create policy "Matches are modifiable by scoped admins"
  on public.matches
  for all
  using (public.can_manage_match(auth.uid(), id))
  with check (
    (
      show_id is not null
      and public.can_manage_show(auth.uid(), show_id)
    )
    or (
      show_id is null
      and event_id is not null
      and public.can_manage_event(auth.uid(), event_id)
    )
  );

drop policy if exists "Match sides are modifiable by admins" on public.match_sides;
drop policy if exists "Match sides are modifiable by scoped admins" on public.match_sides;
create policy "Match sides are modifiable by scoped admins"
  on public.match_sides
  for all
  using (public.can_manage_match(auth.uid(), match_id))
  with check (public.can_manage_match(auth.uid(), match_id));

drop policy if exists "Match entrants are modifiable by admins" on public.match_entrants;
drop policy if exists "Match entrants are modifiable by scoped admins" on public.match_entrants;
create policy "Match entrants are modifiable by scoped admins"
  on public.match_entrants
  for all
  using (public.can_manage_match(auth.uid(), match_id))
  with check (public.can_manage_match(auth.uid(), match_id));

drop policy if exists "Gauntlet candidates are modifiable by admins"
  on public.gauntlet_candidate_entrants;
drop policy if exists "Gauntlet candidates editable by admins"
  on public.gauntlet_candidate_entrants;
drop policy if exists "Gauntlet candidates are modifiable by scoped admins"
  on public.gauntlet_candidate_entrants;
create policy "Gauntlet candidates are modifiable by scoped admins"
  on public.gauntlet_candidate_entrants
  for all
  using (public.can_manage_match(auth.uid(), match_id))
  with check (public.can_manage_match(auth.uid(), match_id));

drop policy if exists "Gauntlet actual entrants are modifiable by admins"
  on public.gauntlet_actual_entrants;
drop policy if exists "Gauntlet actuals editable by admins"
  on public.gauntlet_actual_entrants;
drop policy if exists "Gauntlet actual entrants are modifiable by scoped admins"
  on public.gauntlet_actual_entrants;
create policy "Gauntlet actual entrants are modifiable by scoped admins"
  on public.gauntlet_actual_entrants
  for all
  using (public.can_manage_match(auth.uid(), match_id))
  with check (public.can_manage_match(auth.uid(), match_id));

drop policy if exists "Rumble entries are modifiable by admins" on public.rumble_entries;
drop policy if exists "Rumble entries are modifiable by scoped admins" on public.rumble_entries;
create policy "Rumble entries are modifiable by scoped admins"
  on public.rumble_entries
  for all
  using (public.can_manage_event(auth.uid(), event_id))
  with check (public.can_manage_event(auth.uid(), event_id));

drop policy if exists "Event action log is viewable by admins" on public.event_action_log;
drop policy if exists "Event action log is viewable by scoped admins" on public.event_action_log;
create policy "Event action log is viewable by scoped admins"
  on public.event_action_log
  for select
  using (public.can_manage_event(auth.uid(), event_id));

drop policy if exists "Event action log is modifiable by admins" on public.event_action_log;
drop policy if exists "Event action log is modifiable by scoped admins" on public.event_action_log;
create policy "Event action log is modifiable by scoped admins"
  on public.event_action_log
  for all
  using (public.can_manage_event(auth.uid(), event_id))
  with check (public.can_manage_event(auth.uid(), event_id));

drop policy if exists "Scores are modifiable by admins" on public.scores;
drop policy if exists "Scores are modifiable by scoped admins" on public.scores;
create policy "Scores are modifiable by scoped admins"
  on public.scores
  for insert
  with check (
    event_id is not null
    and public.can_manage_event(auth.uid(), event_id)
  );

drop policy if exists "Scores are updateable by scoped admins" on public.scores;
create policy "Scores are updateable by scoped admins"
  on public.scores
  for update
  using (
    event_id is not null
    and public.can_manage_event(auth.uid(), event_id)
  )
  with check (
    event_id is not null
    and public.can_manage_event(auth.uid(), event_id)
  );

drop policy if exists "Scores are deletable by admins" on public.scores;
create policy "Scores are deletable by admins"
  on public.scores
  for delete
  using (public.is_admin(auth.uid()));

drop policy if exists "Show review links are viewable by admins"
  on public.show_review_links;
drop policy if exists "Show review links are viewable by scoped admins"
  on public.show_review_links;
create policy "Show review links are viewable by scoped admins"
  on public.show_review_links
  for select
  using (public.can_manage_promotion(auth.uid(), promotion_id));

drop policy if exists "Show review links are insertable by admins"
  on public.show_review_links;
drop policy if exists "Show review links are insertable by scoped admins"
  on public.show_review_links;
create policy "Show review links are insertable by scoped admins"
  on public.show_review_links
  for insert
  with check (public.can_manage_promotion(auth.uid(), promotion_id));

drop policy if exists "Show review links are updateable by admins"
  on public.show_review_links;
drop policy if exists "Show review links are updateable by scoped admins"
  on public.show_review_links;
create policy "Show review links are updateable by scoped admins"
  on public.show_review_links
  for update
  using (public.can_manage_promotion(auth.uid(), promotion_id))
  with check (public.can_manage_promotion(auth.uid(), promotion_id));

drop policy if exists "Show review links are deletable by admins"
  on public.show_review_links;
drop policy if exists "Show review links are deletable by scoped admins"
  on public.show_review_links;
create policy "Show review links are deletable by scoped admins"
  on public.show_review_links
  for delete
  using (public.can_manage_promotion(auth.uid(), promotion_id));

drop policy if exists "Picks are deletable by admins" on public.picks;
drop policy if exists "Picks are deletable by admins only" on public.picks;
create policy "Picks are deletable by admins only"
  on public.picks
  for delete
  using (public.is_admin(auth.uid()));
