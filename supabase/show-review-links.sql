-- Adds tokenized, revocable review links for non-persistent show previews.
create table if not exists public.show_review_links (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references public.shows(id) on delete cascade,
  promotion_id uuid references public.promotions(id) on delete set null,
  token_hash text not null unique,
  label text,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists show_review_links_show_id_idx
  on public.show_review_links (show_id);

create index if not exists show_review_links_promotion_id_idx
  on public.show_review_links (promotion_id);

create index if not exists show_review_links_expires_at_idx
  on public.show_review_links (expires_at);

create index if not exists show_review_links_active_idx
  on public.show_review_links (show_id, expires_at)
  where revoked_at is null;

alter table public.show_review_links enable row level security;

drop policy if exists "Show review links are viewable by admins"
  on public.show_review_links;
create policy "Show review links are viewable by admins"
  on public.show_review_links
  for select
  using (public.is_admin(auth.uid()));

drop policy if exists "Show review links are insertable by admins"
  on public.show_review_links;
create policy "Show review links are insertable by admins"
  on public.show_review_links
  for insert
  with check (public.is_admin(auth.uid()));

drop policy if exists "Show review links are updateable by admins"
  on public.show_review_links;
create policy "Show review links are updateable by admins"
  on public.show_review_links
  for update
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

drop policy if exists "Show review links are deletable by admins"
  on public.show_review_links;
create policy "Show review links are deletable by admins"
  on public.show_review_links
  for delete
  using (public.is_admin(auth.uid()));
