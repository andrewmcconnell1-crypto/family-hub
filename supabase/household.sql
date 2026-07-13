-- Household sharing
-- =================
-- Lets two (or more) people who each have their own login share one family
-- hub: the same children, calendar, documents and photos. Run this once in
-- the Supabase SQL editor (after setup.sql).
--
-- Model: a "household" is identified by its owner's user id — the user whose
-- existing `family_data` row (and `family-files` storage folder) holds the
-- shared data. `household_members` maps each user to the household they
-- belong to (their own id when they're solo). Cross-user work happens in
-- SECURITY DEFINER functions so the row-level security policies stay simple
-- and non-recursive.
--
-- This migration is ADDITIVE: it does not drop or change the policies from
-- setup.sql, so accounts that never join a household keep working as before.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.household_members (
  member_id  uuid primary key references auth.users (id) on delete cascade,
  owner_id   uuid not null references auth.users (id) on delete cascade,
  email      text,
  role       text not null default 'member',
  created_at timestamptz not null default now()
);

create index if not exists household_members_owner_idx
  on public.household_members (owner_id);

create table if not exists public.household_invites (
  code       text primary key,
  owner_id   uuid not null references auth.users (id) on delete cascade,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days'
);

alter table public.household_members enable row level security;
alter table public.household_invites enable row level security;

-- ---------------------------------------------------------------------------
-- Helper: the household a user belongs to (their own id when solo).
-- SECURITY DEFINER so policies can call it without recursive RLS on
-- household_members.
-- ---------------------------------------------------------------------------
create or replace function public.household_owner(uid uuid)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select owner_id from public.household_members where member_id = uid),
    uid
  );
$$;

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------
-- Members: you can read everyone in your own household, and remove only
-- yourself. Inserts go exclusively through the join RPC below.
drop policy if exists household_members_select on public.household_members;
create policy household_members_select on public.household_members
  for select using (owner_id = public.household_owner(auth.uid()));

drop policy if exists household_members_delete on public.household_members;
create policy household_members_delete on public.household_members
  for delete using (member_id = auth.uid());

-- family_data: ADD household-aware access alongside the policies from
-- setup.sql. Postgres OR's permissive policies together, so the existing
-- "user_id = auth.uid()" rules keep working and these simply also allow a
-- member to reach their household owner's row. For a solo user
-- household_owner(uid) = uid, so these are a harmless no-op.
drop policy if exists family_data_household_select on public.family_data;
create policy family_data_household_select on public.family_data
  for select using (user_id = public.household_owner(auth.uid()));

drop policy if exists family_data_household_insert on public.family_data;
create policy family_data_household_insert on public.family_data
  for insert with check (user_id = public.household_owner(auth.uid()));

drop policy if exists family_data_household_update on public.family_data;
create policy family_data_household_update on public.family_data
  for update using (user_id = public.household_owner(auth.uid()))
  with check (user_id = public.household_owner(auth.uid()));

-- Storage: members can also reach the files in their household owner's
-- folder of the family-files bucket (documents and photos).
drop policy if exists "household files select" on storage.objects;
create policy "household files select" on storage.objects
  for select using (
    bucket_id = 'family-files'
    and (storage.foldername(name))[1] = public.household_owner(auth.uid())::text
  );

drop policy if exists "household files insert" on storage.objects;
create policy "household files insert" on storage.objects
  for insert with check (
    bucket_id = 'family-files'
    and (storage.foldername(name))[1] = public.household_owner(auth.uid())::text
  );

drop policy if exists "household files update" on storage.objects;
create policy "household files update" on storage.objects
  for update using (
    bucket_id = 'family-files'
    and (storage.foldername(name))[1] = public.household_owner(auth.uid())::text
  );

drop policy if exists "household files delete" on storage.objects;
create policy "household files delete" on storage.objects
  for delete using (
    bucket_id = 'family-files'
    and (storage.foldername(name))[1] = public.household_owner(auth.uid())::text
  );

-- ---------------------------------------------------------------------------
-- RPCs (all SECURITY DEFINER; callable by any signed-in user)
-- ---------------------------------------------------------------------------

-- Create a short invite code for the caller's household, creating the caller's
-- own owner membership row first if they were still solo.
create or replace function public.create_household_invite()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  me        uuid := auth.uid();
  my_email  text;
  the_owner uuid;
  new_code  text;
begin
  if me is null then
    raise exception 'not_authenticated';
  end if;

  select email into my_email from auth.users where id = me;

  insert into public.household_members (member_id, owner_id, email, role)
  values (me, me, my_email, 'owner')
  on conflict (member_id) do nothing;

  the_owner := public.household_owner(me);

  new_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  insert into public.household_invites (code, owner_id, created_by)
  values (new_code, the_owner, me);

  return new_code;
end;
$$;

-- Join the household an invite code belongs to. Returns the household owner id.
create or replace function public.join_household(invite_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me           uuid := auth.uid();
  my_email     text;
  target_owner uuid;
  owner_email  text;
begin
  if me is null then
    raise exception 'not_authenticated';
  end if;

  select owner_id into target_owner
  from public.household_invites
  where code = upper(trim(invite_code)) and expires_at > now();

  if target_owner is null then
    raise exception 'invalid_or_expired_code';
  end if;

  if target_owner = me then
    raise exception 'cannot_join_own_household';
  end if;

  select email into my_email from auth.users where id = me;
  select email into owner_email from auth.users where id = target_owner;

  -- Make sure the owner has their own owner row (idempotent).
  insert into public.household_members (member_id, owner_id, email, role)
  values (target_owner, target_owner, owner_email, 'owner')
  on conflict (member_id) do nothing;

  insert into public.household_members (member_id, owner_id, email, role)
  values (me, target_owner, my_email, 'member')
  on conflict (member_id)
    do update set owner_id = excluded.owner_id,
                  email = excluded.email,
                  role = 'member';

  return target_owner;
end;
$$;

-- Leave the household you joined (no effect for an owner — they disband).
create or replace function public.leave_household()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  delete from public.household_members
  where member_id = me and role <> 'owner';
end;
$$;

-- Owner removes another member from the household.
create or replace function public.remove_household_member(target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  if target = me then
    return;
  end if;

  if exists (
    select 1 from public.household_members
    where member_id = me and owner_id = me and role = 'owner'
  ) then
    delete from public.household_members
    where member_id = target and owner_id = me;
  end if;
end;
$$;

-- Owner disbands the household: everyone reverts to solo, invites are cleared.
create or replace function public.disband_household()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  if exists (
    select 1 from public.household_members
    where member_id = me and owner_id = me and role = 'owner'
  ) then
    delete from public.household_members where owner_id = me;
    delete from public.household_invites where owner_id = me;
  end if;
end;
$$;

grant execute on function public.household_owner(uuid) to authenticated;
grant execute on function public.create_household_invite() to authenticated;
grant execute on function public.join_household(text) to authenticated;
grant execute on function public.leave_household() to authenticated;
grant execute on function public.remove_household_member(uuid) to authenticated;
grant execute on function public.disband_household() to authenticated;
