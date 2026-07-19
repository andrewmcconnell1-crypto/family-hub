# Reminders, calendar feed & subscribing to other calendars — one-time Supabase setup

Three features share this setup:

- **Reminders** — push notifications: a morning digest of the day ahead, a
  nudge before events that have a reminder set, and a ping when a to-do is
  due. Turned on per device from the app's Family tab.
- **Calendar feed** — a private link Google Calendar / Apple Calendar can
  subscribe to, so Nest events appear alongside everything else
  (Nest → other apps).
- **Other calendars** — subscribe Nest to a Google/Outlook/Apple
  calendar's iCal link, so those events show up read-only in Nest
  (other apps → Nest). This one needs the `ics-proxy` function below.

Everything below happens in the [Supabase dashboard](https://supabase.com/dashboard)
for the Nest project. Allow ~10 minutes.

## 1. Create the tables

SQL Editor → New query → paste the whole of `supabase/reminders.sql` → Run.

## 2. Deploy the edge functions

Edge Functions → **Deploy a new function** → *Via Editor*:

1. Name it `calendar-feed`, replace the sample code with the contents of
   `supabase/functions/calendar-feed/index.ts`, and deploy.
2. Repeat with the name `send-reminders` and
   `supabase/functions/send-reminders/index.ts`.
3. Repeat with the name `send-due-reminders` and
   `supabase/functions/send-due-reminders/index.ts`.
4. Repeat with the name `ics-proxy` and
   `supabase/functions/ics-proxy/index.ts`.

Then turn **Enforce JWT verification OFF** for `calendar-feed`,
`send-reminders` and `send-due-reminders` (open each → Details). Calendar
apps and the scheduler can't send Supabase auth headers, so those rely on the
secret token / cron key instead.

**Leave JWT verification ON for `ics-proxy`** — it should only be callable by
signed-in Nest users, so it can't be abused as an open proxy. (It's on
by default; just don't turn it off.)

## 3. Set the secrets

Edge Functions → Secrets (or Project Settings → Edge Functions). Add:

| Name | Value |
| --- | --- |
| `VAPID_KEYS` | The JSON printed by `node scripts/generate-vapid-keys.mjs` (private — never commit it). If you were given this value in chat, use that one: it matches the public key already in the app. |
| `CRON_SECRET` | Any long random string — the same one you put in the cron job below. |
| `REMINDER_TZ` | Your IANA timezone, e.g. `Australia/Sydney`, `Europe/London`. Sets which day "today" means, and turns event/to-do local times into real times. |
| `REMINDER_TODO_HOUR` | Optional. Hour (0–23, local) that a to-do due-date reminder fires. Default `9`. |
| `APP_URL` | Optional. Where tapping the notification opens. Defaults to the GitHub Pages app. |

## 4. Schedule the two reminder jobs

Reminders send when something calls the functions on a schedule. Use
Supabase's built-in cron (Database → Extensions → enable **pg_cron** and
**pg_net** if they aren't already), then run this in the SQL Editor —
replacing `YOUR-PROJECT-REF` (the part before `.supabase.co` in your project
URL) and `YOUR-CRON-SECRET`:

```sql
-- (a) Morning digest, once a day.
select cron.schedule(
  'nest-morning-digest',
  '0 21 * * *',  -- runs at 21:00 UTC = 7:00am next day in Sydney (AEST is UTC+10)
  $$
  select net.http_post(
    url := 'https://YOUR-PROJECT-REF.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object('x-cron-key', 'YOUR-CRON-SECRET')
  );
  $$
);

-- (b) Per-event / per-to-do reminders, every 15 minutes.
select cron.schedule(
  'nest-due-reminders',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://YOUR-PROJECT-REF.supabase.co/functions/v1/send-due-reminders',
    headers := jsonb_build_object('x-cron-key', 'YOUR-CRON-SECRET')
  );
  $$
);
```

For the digest, pick the UTC hour that matches the local time you want:
`local time − UTC offset`. Examples for a 7am digest: Sydney (UTC+10) → `21`,
London winter (UTC+0) → `7`, New York winter (UTC−5) → `12`.
(pg_cron runs in UTC and doesn't follow daylight saving — the digest will
drift an hour when the clocks change; adjust the schedule then if you care.
The 15-minute job is unaffected since it's relative to "now".)

To test immediately, open a terminal (or use any HTTP tool):

```
curl "https://YOUR-PROJECT-REF.supabase.co/functions/v1/send-reminders?key=YOUR-CRON-SECRET"
curl "https://YOUR-PROJECT-REF.supabase.co/functions/v1/send-due-reminders?key=YOUR-CRON-SECRET"
```

`send-reminders` replies `{"today":"…","sent":N,"skipped":N}`;
`send-due-reminders` replies `{"now":"…","sent":N,"deduped":N}`. `sent: 0`
just means nothing was due in that window.

## 5. Turn things on in the app

- **Reminders**: Family tab → Reminders → *Turn on reminders* on each device
  that should get them. On iPhone the app must be opened from the Home Screen
  icon (Add to Home Screen first) — iOS only allows notifications for
  installed web apps. Then set a reminder on individual events (the Reminder
  field in an event, e.g. “30 minutes before”) and on to-dos with a due date
  (“Remind me on the due date”). The morning digest needs no per-item setup.
- **Calendar feed**: Family tab → Calendar feed → *Create feed link* → Copy,
  then in Google Calendar: Settings → Add calendar → **From URL** → paste
  (or iPhone: Settings → Apps → Calendar → Calendar Accounts → Add Account →
  Other → **Add Subscribed Calendar**). Google refreshes subscribed feeds
  every few hours — new Nest events appear with a delay, that's normal.
- **Other calendars** (Google/Outlook/Apple → Nest): Family tab → Other
  calendars → *Add a calendar* → paste the calendar's private iCal / .ics
  address (the card lists where to find it in each app). Those events then
  show read-only in the Week, Calendar and Home views, colour-coded. Needs
  the `ics-proxy` function from step 2 and you signed in. Nest refreshes
  each feed on open and every few hours, so a brand-new event in the other
  app can take a little while to appear.

## Rotating the push keys

If the VAPID keys ever need replacing: run
`node scripts/generate-vapid-keys.mjs`, put the printed public key into
`PUSH_PUBLIC_KEY` in `src/lib/push.js` (commit + deploy), set the printed
JSON as the `VAPID_KEYS` secret, and have every device turn reminders off
and on again.
