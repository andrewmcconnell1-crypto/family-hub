-- Reminders (web push) + calendar feed
-- ====================================
-- Run this once in the Supabase SQL editor (after setup.sql; household.sql is
-- optional but recommended). It adds two small tables:
--
--   push_subscriptions  one row per device that turned reminders on. The
--                       send-reminders edge function reads these to know
--                       where to deliver the morning digest.
--   calendar_feeds      one secret token per user. The calendar-feed edge
--                       function turns it into a private ICS URL that Google
--                       Calendar / Apple Calendar can subscribe to.
--
-- Both tables are protected by row-level security: each signed-in user can
-- only manage their own rows. The edge functions use the service-role key,
-- which bypasses RLS on the server only.

create table if not exists public.push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  endpoint     text not null unique,
  subscription jsonb not null,
  created_at   timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists push_subscriptions_select on public.push_subscriptions;
create policy push_subscriptions_select on public.push_subscriptions
  for select using (user_id = auth.uid());

drop policy if exists push_subscriptions_insert on public.push_subscriptions;
create policy push_subscriptions_insert on public.push_subscriptions
  for insert with check (user_id = auth.uid());

drop policy if exists push_subscriptions_update on public.push_subscriptions;
create policy push_subscriptions_update on public.push_subscriptions
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists push_subscriptions_delete on public.push_subscriptions;
create policy push_subscriptions_delete on public.push_subscriptions
  for delete using (user_id = auth.uid());

create table if not exists public.calendar_feeds (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  token      text not null unique,
  created_at timestamptz not null default now()
);

-- Dedupe log for per-event / per-to-do reminders, so the every-15-minutes
-- send-due-reminders function never sends the same reminder twice. Keyed by
-- household owner so a shared hub gets each reminder once. Written only by the
-- edge function (service role, which bypasses RLS); no user policies needed.
create table if not exists public.sent_notifications (
  owner_id  uuid not null references auth.users (id) on delete cascade,
  notif_key text not null,
  sent_at   timestamptz not null default now(),
  primary key (owner_id, notif_key)
);

alter table public.sent_notifications enable row level security;

alter table public.calendar_feeds enable row level security;

drop policy if exists calendar_feeds_select on public.calendar_feeds;
create policy calendar_feeds_select on public.calendar_feeds
  for select using (user_id = auth.uid());

drop policy if exists calendar_feeds_insert on public.calendar_feeds;
create policy calendar_feeds_insert on public.calendar_feeds
  for insert with check (user_id = auth.uid());

drop policy if exists calendar_feeds_update on public.calendar_feeds;
create policy calendar_feeds_update on public.calendar_feeds
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists calendar_feeds_delete on public.calendar_feeds;
create policy calendar_feeds_delete on public.calendar_feeds
  for delete using (user_id = auth.uid());
