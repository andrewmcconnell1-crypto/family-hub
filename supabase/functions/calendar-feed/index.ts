// Treehouse calendar feed (Supabase Edge Function)
// ================================================
// Serves the household's calendar as an ICS feed that Google Calendar /
// Apple Calendar can subscribe to:
//
//   GET https://<project>.supabase.co/functions/v1/calendar-feed?token=SECRET
//
// The token comes from the calendar_feeds table (created by the app's
// "Calendar feed" card). Deploy this function with JWT verification turned
// OFF — calendar apps can't send auth headers; the long random token is the
// credential. Recurring events are expanded into dated occurrences (same
// rules as the app), birthdays are synthesised from members' dates of birth.
//
// Self-contained on purpose: the recurrence logic below mirrors
// src/utils/recurrence.js, using UTC date maths so results don't depend on
// the server's timezone.

import { createClient } from "npm:@supabase/supabase-js@2";

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
      if (matchesRepeat(event, key) && !exceptions.includes(key)) {
        out.push({ ...event, date: key });
      }
    }
  }
  return out;
}

function birthdays(children: Ev[], startKey: string, endKey: string): Ev[] {
  const out: Ev[] = [];
  for (const child of children || []) {
    if (!child?.dob) continue;
    const dob = new Date(parse(child.dob));
    const startYear = Number(startKey.slice(0, 4));
    const endYear = Number(endKey.slice(0, 4));
    for (let year = startYear; year <= endYear; year++) {
      const age = year - dob.getUTCFullYear();
      if (age < 1) continue;
      const key = `${year}-${child.dob.slice(5)}`;
      if (key < startKey || key > endKey) continue;
      out.push({
        id: `birthday-${child.id}-${year}`,
        title: `${child.name} turns ${age} 🎂`,
        date: key,
        time: "",
        notes: "",
        category: "birthday",
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// ICS output
// ---------------------------------------------------------------------------
const escapeText = (value: string) =>
  String(value).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

// Fold long content lines per RFC 5545 (continuation lines start with a space).
const fold = (line: string) => {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 73) {
    out.push(rest.slice(0, 73));
    rest = " " + rest.slice(73);
  }
  out.push(rest);
  return out.join("\r\n");
};

function icsForEvents(events: Ev[], calendarName: string): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Treehouse//Family Hub//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(calendarName)}`,
    "X-PUBLISHED-TTL:PT12H",
  ];
  for (const event of events) {
    const day = event.date.replace(/-/g, "");
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${event.id}-${day}@treehouse`);
    lines.push(`DTSTAMP:${stamp}`);
    lines.push(fold(`SUMMARY:${escapeText(event.title)}`));
    if (event.time) {
      // Floating local time: shows at the same wall-clock time in any zone.
      const hhmm = event.time.replace(":", "");
      lines.push(`DTSTART:${day}T${hhmm}00`);
      const endMinutes = Number(event.time.slice(0, 2)) * 60 + Number(event.time.slice(3)) + 60;
      const endH = String(Math.floor(endMinutes / 60) % 24).padStart(2, "0");
      const endM = String(endMinutes % 60).padStart(2, "0");
      const endDay = endMinutes >= 24 * 60 ? addDays(event.date, 1).replace(/-/g, "") : day;
      lines.push(`DTEND:${endDay}T${endH}${endM}00`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${day}`);
      lines.push(`DTEND;VALUE=DATE:${addDays(event.date, 1).replace(/-/g, "")}`);
    }
    if (event.notes) lines.push(fold(`DESCRIPTION:${escapeText(event.notes)}`));
    if (event.category) lines.push(`CATEGORIES:${escapeText(event.category)}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
Deno.serve(async (req) => {
  const token = new URL(req.url).searchParams.get("token") || "";
  if (token.length < 20) return new Response("Not found", { status: 404 });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: feed } = await supabase
    .from("calendar_feeds")
    .select("user_id")
    .eq("token", token)
    .maybeSingle();
  if (!feed) return new Response("Not found", { status: 404 });

  // The feed serves the user's household data (their own when solo).
  const { data: membership } = await supabase
    .from("household_members")
    .select("owner_id")
    .eq("member_id", feed.user_id)
    .maybeSingle();
  const ownerId = membership?.owner_id || feed.user_id;

  const { data: row } = await supabase
    .from("family_data")
    .select("data")
    .eq("user_id", ownerId)
    .maybeSingle();
  const familyData = row?.data || {};

  const today = new Date().toISOString().slice(0, 10);
  const startKey = addDays(today, -60);
  const endKey = addDays(today, 400);
  const all = [
    ...occurrences(familyData.events, startKey, endKey),
    ...birthdays(familyData.children, startKey, endKey),
  ].sort((a, b) => a.date.localeCompare(b.date));

  return new Response(icsForEvents(all, "Treehouse"), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "private, max-age=900",
      "Content-Disposition": 'inline; filename="treehouse.ics"',
    },
  });
});
