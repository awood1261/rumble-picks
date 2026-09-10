-- Supabase Storage policies for admin-managed wrestler photos.
-- Keeps existing public image URL behavior while limiting browser writes to admins.

insert into storage.buckets (id, name, public)
values ('entrant-images', 'entrant-images', true)
on conflict (id) do update set public = true;

drop policy if exists "Entrant images are publicly readable" on storage.objects;
create policy "Entrant images are publicly readable"
  on storage.objects
  for select
  using (bucket_id = 'entrant-images');

drop policy if exists "Entrant images are uploadable by admins" on storage.objects;
create policy "Entrant images are uploadable by admins"
  on storage.objects
  for insert
  with check (
    bucket_id = 'entrant-images'
    and public.is_admin(auth.uid())
  );

drop policy if exists "Entrant images are updateable by admins" on storage.objects;
create policy "Entrant images are updateable by admins"
  on storage.objects
  for update
  using (
    bucket_id = 'entrant-images'
    and public.is_admin(auth.uid())
  )
  with check (
    bucket_id = 'entrant-images'
    and public.is_admin(auth.uid())
  );
