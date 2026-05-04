-- Champion card / champion claim schema reference.
-- Applied manually in Supabase SQL editor on 2026-04-27.
-- Execution choice used: "Run and enable RLS".

begin;

create extension if not exists pgcrypto;

create table if not exists public.champion_card_codes (
  id uuid primary key default gen_random_uuid(),
  promotion_id uuid not null references public.promotions(id) on delete cascade,
  code text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists champion_card_codes_promotion_idx
  on public.champion_card_codes (promotion_id);

create index if not exists champion_card_codes_promotion_active_idx
  on public.champion_card_codes (promotion_id, active);

create table if not exists public.champion_claims (
  id uuid primary key default gen_random_uuid(),
  promotion_id uuid not null references public.promotions(id) on delete cascade,
  show_id uuid null references public.shows(id) on delete set null,
  claim_type text not null check (claim_type in ('show_winner', 'champion_profile')),
  claimed_username text not null,
  claimed_avatar text null,
  source_code_id uuid not null references public.champion_card_codes(id) on delete restrict,
  claimed_by_user_id uuid null references auth.users(id) on delete set null,
  claimed_by_guest_id text null,
  created_at timestamptz not null default now(),
  check (
    claimed_by_user_id is not null
    or claimed_by_guest_id is not null
  )
);

create index if not exists champion_claims_promotion_idx
  on public.champion_claims (promotion_id);

create index if not exists champion_claims_show_idx
  on public.champion_claims (show_id);

create index if not exists champion_claims_claim_type_idx
  on public.champion_claims (claim_type);

create index if not exists champion_claims_user_idx
  on public.champion_claims (claimed_by_user_id);

create index if not exists champion_claims_guest_idx
  on public.champion_claims (claimed_by_guest_id);

create index if not exists champion_claims_promotion_created_idx
  on public.champion_claims (promotion_id, created_at desc);

create or replace view public.v_latest_champion_claims as
select distinct on (
  coalesce(claimed_by_user_id::text, claimed_by_guest_id),
  promotion_id,
  claim_type,
  coalesce(show_id::text, 'no-show')
)
  id,
  promotion_id,
  show_id,
  claim_type,
  claimed_username,
  claimed_avatar,
  source_code_id,
  claimed_by_user_id,
  claimed_by_guest_id,
  created_at
from public.champion_claims
order by
  coalesce(claimed_by_user_id::text, claimed_by_guest_id),
  promotion_id,
  claim_type,
  coalesce(show_id::text, 'no-show'),
  created_at desc;

commit;
