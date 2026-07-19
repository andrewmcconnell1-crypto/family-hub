// Nest morning digest (Supabase Edge Function)
// =================================================
// Sends one web-push notification per subscribed device summarising the day:
// today's events (recurring ones expanded, birthdays included), to-dos due
// today, overdue to-dos, and documents expiring in the next fortnight.
// Devices with nothing on today get nothing — no empty notifications.
//
// Deploy with JWT verification OFF and call it on a schedule (see
// supabase/reminders-setup.md). Secrets used:
//   VAPID_KEYS   JSON with the push keypair: {"publicKey":{...},"privateKey":{...}}
//   CRON_SECRET  shared secret the caller must send as an x-cron-key header
//                (or ?key= query param)
//   REMINDER_TZ  IANA timezone the digest's "today" is computed in,
//                e.g. Australia/Sydney or Europe/London (default UTC)
//   APP_URL      where tapping the notification opens (defaults to the
//                GitHub Pages app)
//
// The recurrence logic mirrors src/utils/recurrence.js (UTC date maths).

import { createClient } from "npm:@supabase/supabase-js@2";
import * as webpush from "jsr:@negrel/webpush";

// ---------------------------------------------------------------------------
// Date keys (YYYY-MM-DD), UTC-based
// ---------------------------------------------------------------------------
const parse = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};
const toKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const addDays = (key: string, delta: number) => toKey(parse(key) + delta * 86400000);
const weekdayIndex = (key: string) => (new Date(parse(key)).getUTCDay() + 6) % 7; // Mon=0
const daysBetween = (a: string, b: string) => Math.round((parse(b) - parse(a)) / 86400000);

// Today's date key in the digest timezone ("en-CA" formats as YYYY-MM-DD).
const todayKeyIn = (timeZone: string) => {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
};

// ---------------------------------------------------------------------------
// Recurrence expansion (mirrors src/utils/recurrence.js)
// ---------------------------------------------------------------------------
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
      const weeks = Math.floor(daysBetween(anchorMonday, key) / 7);
      return weeks % 2 === 0;
    }
    case "monthly":
      return day.getUTCDate() === anchor.getUTCDate();
    case "yearly":
      return day.getUTCDate() === anchor.getUTCDate() && day.getUTCMonth() === anchor.getUTCMonth();
    default:
      return false;
  }
}

function eventsOn(familyData: Ev, key: string): Ev[] {
  const out: Ev[] = [];
  for (const event of familyData.events || []) {
    if (!event?.date || !event?.title) continue;
    const exceptions = Array.isArray(event.exceptions) ? event.exceptions : [];
    if (!event.repeat || event.repeat === "none") {
      if (event.date === key) out.push(event);
    } else if (
      event.date <= key &&
      (!event.endDate || key <= event.endDate) &&
      matchesRepeat(event, key) &&
      !exceptions.includes(key)
    ) {
      out.push(event);
    }
  }
  for (const child of familyData.children || []) {
    if (!child?.dob || child.dob.slice(5) !== key.slice(5)) continue;
    const age = Number(key.slice(0, 4)) - Number(child.dob.slice(0, 4));
    if (age >= 1) out.push({ title: `${child.name} turns ${age} 🎂`, time: "" });
  }
  return out.sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"));
}

// "15:30" -> "3:30pm"
const friendlyTime = (time: string) => {
  if (!time) return "";
  const h = Number(time.slice(0, 2));
  const suffix = h >= 12 ? "pm" : "am";
  const hour = h % 12 || 12;
  return time.slice(3) === "00" ? `${hour}${suffix}` : `${hour}:${time.slice(3)}${suffix}`;
};

function digestFor(familyData: Ev, todayKey: string): string[] {
  const lines: string[] = [];

  const events = eventsOn(familyData, todayKey);
  for (const event of events.slice(0, 4)) {
    lines.push(event.time ? `${friendlyTime(event.time)} ${event.title}` : event.title);
  }
  if (events.length > 4) lines.push(`…and ${events.length - 4} more today`);

  const todos = (familyData.todos || []).filter((t: Ev) => t && !t.done && t.dueDate);
  const dueToday = todos.filter((t: Ev) => t.dueDate === todayKey);
  const overdue = todos.filter((t: Ev) => t.dueDate < todayKey);
  for (const todo of dueToday.slice(0, 3)) lines.push(`Due today: ${todo.title}`);
  if (dueToday.length > 3) lines.push(`…and ${dueToday.length - 3} more due today`);
  if (overdue.length > 0) {
    lines.push(overdue.length === 1 ? `Overdue: ${overdue[0].title}` : `${overdue.length} to-dos overdue`);
  }

  const horizon = addDays(todayKey, 14);
  const expiring = (familyData.documents || [])
    .filter((d: Ev) => d?.expiryDate && d.expiryDate <= horizon)
    .sort((a: Ev, b: Ev) => a.expiryDate.localeCompare(b.expiryDate));
  for (const doc of expiring.slice(0, 2)) {
    lines.push(doc.expiryDate < todayKey ? `${doc.title} has expired` : `${doc.title} expires ${doc.expiryDate}`);
  }

  return lines;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
Deno.serve(async (req) => {
  const url = new URL(req.url);
  const cronSecret = Deno.env.get("CRON_SECRET") || "";
  const given = req.headers.get("x-cron-key") || url.searchParams.get("key") || "";
  if (!cronSecret || given !== cronSecret) {
    return new Response("Forbidden", { status: 403 });
  }

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

  const timeZone = Deno.env.get("REMINDER_TZ") || "UTC";
  const appUrl = Deno.env.get("APP_URL") || "https://andrewmcconnell1-crypto.github.io/family-hub/";
  const todayKey = todayKeyIn(timeZone);
  const dayLabel = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "short",
  }).format(new Date());

  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("id, user_id, endpoint, subscription");
  if (error) return new Response(`DB error: ${error.message}`, { status: 500 });

  // Resolve each subscriber's household owner, then load each owner's data
  // once and build the digest once per owner.
  const owners = new Map<string, string>(); // user_id -> owner_id
  for (const sub of subs || []) {
    if (owners.has(sub.user_id)) continue;
    const { data: membership } = await supabase
      .from("household_members")
      .select("owner_id")
      .eq("member_id", sub.user_id)
      .maybeSingle();
    owners.set(sub.user_id, membership?.owner_id || sub.user_id);
  }
  const digests = new Map<string, string[]>(); // owner_id -> lines
  for (const ownerId of new Set(owners.values())) {
    const { data: row } = await supabase
      .from("family_data")
      .select("data")
      .eq("user_id", ownerId)
      .maybeSingle();
    digests.set(ownerId, row?.data ? digestFor(row.data, todayKey) : []);
  }

  let sent = 0;
  let skipped = 0;
  let removed = 0;
  const failures: string[] = [];
  for (const sub of subs || []) {
    const lines = digests.get(owners.get(sub.user_id)!) || [];
    if (lines.length === 0) {
      skipped++;
      continue;
    }
    const payload = JSON.stringify({
      title: `Nest — ${dayLabel}`,
      body: lines.join("\n"),
      url: appUrl,
    });
    try {
      const subscriber = appServer.subscribe(sub.subscription);
      await subscriber.pushTextMessage(payload, {});
      sent++;
    } catch (err) {
      // A gone/expired subscription (device turned reminders off, or the
      // browser rotated it) is cleaned up; other errors are reported.
      if (err instanceof webpush.PushMessageError && err.isGone()) {
        await supabase.from("push_subscriptions").delete().eq("id", sub.id);
        removed++;
      } else {
        failures.push(`${sub.endpoint.slice(0, 40)}…: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  return Response.json({ today: todayKey, sent, skipped, removed, failures });
});
