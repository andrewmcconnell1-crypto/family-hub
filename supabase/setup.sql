-- Treehouse cloud setup. Run this once in the Supabase SQL editor
-- (Dashboard → SQL Editor → New query → paste → Run).

-- 1) Metadata: one private row of JSON per user.
create table if not exists public.family_data (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.family_data enable row level security;

create policy "own data select" on public.family_data
  for select using (auth.uid() = user_id);
create policy "own data insert" on public.family_data
  for insert with check (auth.uid() = user_id);
create policy "own data update" on public.family_data
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Live cross-device updates (realtime). Without it, the app still works but
-- other devices only refresh on reload.
alter publication supabase_realtime add table public.family_data;

-- 2) Files: a PRIVATE storage bucket. Each user's files live under a folder
--    named with their user id; the policies below lock access to that folder.
insert into storage.buckets (id, name, public)
values ('family-files', 'family-files', false)
on conflict (id) do nothing;

create policy "own files select" on storage.objects
  for select using (
    bucket_id = 'family-files' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "own files insert" on storage.objects
  for insert with check (
    bucket_id = 'family-files' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "own files update" on storage.objects
  for update using (
    bucket_id = 'family-files' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "own files delete" on storage.objects
  for delete using (
    bucket_id = 'family-files' and (storage.foldername(name))[1] = auth.uid()::text
  );
