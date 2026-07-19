// Nest per-event / per-to-do reminders (Supabase Edge Function)
// ==================================================================
// Runs every ~15 minutes and sends a web-push the moment a reminder falls
// due: an event whose lead time (e.g. 30 min before) has just arrived, or a
// to-do due today at the configured hour. Distinct from send-reminders, which
// is the once-a-day morning digest.
//
// Deploy with JWT verification OFF and schedule it every 15 minutes (see
// supabase/reminders-setup.md). Secrets: VAPID_KEYS, CRON_SECRET, REMINDER_TZ
// and optionally REMINDER_TODO_HOUR (default 9) and APP_URL.
//
// The reminder maths mirrors src/lib/reminders.js; recurrence expansion
// mirrors src/utils/recurrence.js (UTC date maths).

import { createClient } from "npm:@supabase/supabase-js@2";
import * as webpush from "jsr:@negrel/webpush";

// --- Date keys (YYYY-MM-DD), UTC-based ------------------------------------
const parse = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};
const toKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const addDays = (key: string, delta: number) => toKey(parse(key) + delta * 86400000);
const weekdayIndex = (key: string) => (new Date(parse(key)).getUTCDay() + 6) % 7; // Mon=0
const daysBetween = (a: string, b: string) => Math.round((parse(b) - parse(a)) / 86400000);

// --- Timezone: local wall time -> absolute UTC ms -------------------------
function tzOffsetMs(timeZone: string, utcMs: number): number {
  const parts: Record<string, string> = {};
  for (
    const part of new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).formatToParts(new Date(utcMs))
  ) {
    parts[part.type] = part.value;
  }
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - utcMs;
}
function localWallToUtcMs(dateKey: string, time: string, tz: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  const [hh, mm] = (time || "00:00").split(":").map(Number);
  const naive = Date.UTC(y, m - 1, d, hh, mm);
  let utc = naive - tzOffsetMs(tz, naive);
  utc = naive - tzOffsetMs(tz, utc);
  return utc;
}

// --- Recurrence expansion (mirrors src/utils/recurrence.js) ---------------
// deno-lint-ignore no-explicit-any
type Ev = any;
const eventWeekdays = (event: Ev) => {
  const days = Array.isArray(event.weekdays) ? event.weekdays : [];
  return days.length > 0 ? days : [weekdayIndex(event.date)];
};
function matchesRepeat(event: Ev, key: string): boolean {
  const anchor = new Date(parse(event.date));
  const day = new Date(parse(key));
  switch (event.repeat) {
    case "weekly":
      return eventWeekdays(event).includes(weekdayIndex(key));
    case "fortnightly": {
      if (!eventWeekdays(event).includes(weekdayIndex(key))) return false;
      const anchorMonday = addDays(event.date, -weekdayIndex(event.date));
      return Math.floor(daysBetween(anchorMonday, key) / 7) % 2 === 0;
    }
    case "monthly":
      return day.getUTCDate() === anchor.getUTCDate();
    case "yearly":
      return day.getUTCDate() === anchor.getUTCDate() && day.getUTCMonth() === anchor.getUTCMonth();
    default:
      return false;
  }
}
function occurrences(events: Ev[], startKey: string, endKey: string): Ev[] {
  const out: Ev[] = [];
  for (const event of events || []) {
    if (!event?.date || !event?.title) continue;
    if (!event.repeat || event.repeat === "none") {
      if (event.date >= startKey && event.date <= endKey) out.push({ ...event });
      continue;
    }
    const from = event.date > startKey ? event.date : startKey;
    const to = event.endDate && event.endDate < endKey ? event.endDate : endKey;
    const exceptions = Array.isArray(event.exceptions) ? event.exceptions : [];
    for (let key = from; key <= to; key = addDays(key, 1)) {
      if (matchesRepeat(event, key) && !exceptions.includes(key)) out.push({ ...event, date: key });
    }
  }
  return out;
}

const leadLabel = (m: number) =>
  m === 0 ? "starting now"
  : m === 60 ? "in 1 hour"
  : m === 1440 ? "tomorrow"
  : `in ${m} minutes`;

// --- Due reminders in (windowStart, windowEnd] (mirrors reminders.js) -----
function collectDue(
  data: Ev,
  tz: string,
  windowStartMs: number,
  windowEndMs: number,
  todoHour: number,
) {
  const out: { key: string; title: string; body: string }[] = [];
  const startKey = toKey(windowStartMs - 2 * 86400000);
  const endKey = toKey(windowEndMs + 2 * 86400000);
  for (const occ of occurrences(data.events, startKey, endKey)) {
    if (!occ.time || !Number.isInteger(occ.reminder)) continue;
    const fire = localWallToUtcMs(occ.date, occ.time, tz) - occ.reminder * 60000;
    if (fire > windowStartMs && fire <= windowEndMs) {
      out.push({
        key: `evt:${occ.id}:${occ.date}:${occ.reminder}`,
        title: occ.title,
        body: `${occ.time} · ${leadLabel(occ.reminder)}`,
      });
    }
  }
  const hh = String(todoHour).padStart(2, "0");
  for (const todo of data.todos || []) {
    if (!todo?.remind || todo.done || !todo.dueDate) continue;
    const fire = localWallToUtcMs(todo.dueDate, `${hh}:00`, tz);
    if (fire > windowStartMs && fire <= windowEndMs) {
      out.push({ key: `todo:${todo.id}:${todo.dueDate}`, title: "To-do due today", body: todo.title });
    }
  }
  return out;
}

// --- Handler --------------------------------------------------------------
Deno.serve(async (req) => {
  const url = new URL(req.url);
  const cronSecret = Deno.env.get("CRON_SECRET") || "";
  const given = req.headers.get("x-cron-key") || url.searchParams.get("key") || "";
  if (!cronSecret || given !== cronSecret) return new Response("Forbidden", { status: 403 });

  const vapidJson = Deno.env.get("VAPID_KEYS");
  if (!vapidJson) return new Response("VAPID_KEYS secret not set", { status: 500 });
  const vapidKeys = await webpush.importVapidKeys(JSON.parse(vapidJson), { extractable: false });
  const appServer = await webpush.ApplicationServer.new({
    contactInformation: "mailto:noreply@treehouse.local",
    vapidKeys,
  });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const tz = Deno.env.get("REMINDER_TZ") || "UTC";
  const todoHour = Number(Deno.env.get("REMINDER_TODO_HOUR") || "9");
  const appUrl = Deno.env.get("APP_URL") || "https://andrewmcconnell1-crypto.github.io/family-hub/";
  const now = Date.now();
  // A 30-minute look-back gives resilience to a missed run; the dedupe table
  // stops any overlap from double-sending.
  const windowStartMs = now - 30 * 60000;

  // Forget dedupe rows older than 30 days.
  await supabase
    .from("sent_notifications")
    .delete()
    .lt("sent_at", new Date(now - 30 * 86400000).toISOString());

  // Group every push subscription by its household owner.
  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("id, user_id, endpoint, subscription");
  if (error) return new Response(`DB error: ${error.message}`, { status: 500 });

  const ownerOf = new Map<string, string>();
  const subsByOwner = new Map<string, Ev[]>();
  for (const sub of subs || []) {
    if (!ownerOf.has(sub.user_id)) {
      const { data: membership } = await supabase
        .from("household_members")
        .select("owner_id")
        .eq("member_id", sub.user_id)
        .maybeSingle();
      ownerOf.set(sub.user_id, membership?.owner_id || sub.user_id);
    }
    const owner = ownerOf.get(sub.user_id)!;
    if (!subsByOwner.has(owner)) subsByOwner.set(owner, []);
    subsByOwner.get(owner)!.push(sub);
  }

  let sent = 0;
  let deduped = 0;
  let removed = 0;
  for (const [ownerId, ownerSubs] of subsByOwner) {
    const { data: row } = await supabase
      .from("family_data")
      .select("data")
      .eq("user_id", ownerId)
      .maybeSingle();
    if (!row?.data) continue;

    for (const reminder of collectDue(row.data, tz, windowStartMs, now, todoHour)) {
      // Claim the reminder: insert wins → we send; conflict → already sent.
      const { error: insErr } = await supabase
        .from("sent_notifications")
        .insert({ owner_id: ownerId, notif_key: reminder.key });
      if (insErr) {
        deduped++;
        continue;
      }
      const payload = JSON.stringify({ title: reminder.title, body: reminder.body, url: appUrl });
      for (const sub of ownerSubs) {
        try {
          await appServer.subscribe(sub.subscription).pushTextMessage(payload, {});
          sent++;
        } catch (err) {
          if (err instanceof webpush.PushMessageError && err.isGone()) {
            await supabase.from("push_subscriptions").delete().eq("id", sub.id);
            removed++;
          }
        }
      }
    }
  }

  return Response.json({ now: new Date(now).toISOString(), sent, deduped, removed });
});
