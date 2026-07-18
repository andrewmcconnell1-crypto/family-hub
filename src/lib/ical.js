// A small ICS (iCalendar) reader for subscribed external calendars (Google,
// Outlook, iCloud…). Parses VEVENTs and expands them into dated occurrences
// within a window — enough for showing someone else's calendar read-only,
// not a full RFC 5545 implementation.
//
// Supported: all-day and timed events (UTC, TZID and floating times),
// multi-day all-day spans, RRULE FREQ=DAILY/WEEKLY/MONTHLY/YEARLY with
// INTERVAL / BYDAY / BYMONTHDAY / COUNT / UNTIL, EXDATE, RECURRENCE-ID
// overrides and STATUS:CANCELLED. Unknown timezone ids (e.g. Windows names
// some Outlook feeds use) fall back to treating the time as local, which is
// right whenever the family and the feed share a timezone.

import { addDays, toDateKey } from '../utils/dateUtils.js'

// ---------------------------------------------------------------------------
// Text-level parsing
// ---------------------------------------------------------------------------

// Undo RFC 5545 line folding (continuation lines start with space or tab).
function unfoldLines(text) {
  return text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '').split('\n')
}

const unescapeText = (value) =>
  value
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')

// "DTSTART;TZID=Australia/Sydney:20260720T090000" →
//   { name: 'DTSTART', params: { TZID: 'Australia/Sydney' }, value: '2026…' }
function parseLine(line) {
  const colon = line.indexOf(':')
  if (colon === -1) return null
  const head = line.slice(0, colon)
  const value = line.slice(colon + 1)
  const [name, ...paramParts] = head.split(';')
  const params = {}
  for (const part of paramParts) {
    const eq = part.indexOf('=')
    if (eq > 0) params[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1).replace(/^"|"$/g, '')
  }
  return { name: name.toUpperCase(), params, value }
}

// Raw VEVENT blocks from the file.
export function parseIcsEvents(text) {
  const events = []
  let current = null
  for (const line of unfoldLines(text)) {
    if (line === 'BEGIN:VEVENT') {
      current = { exdates: [] }
      continue
    }
    if (line === 'END:VEVENT') {
      if (current) events.push(current)
      current = null
      continue
    }
    if (!current) continue
    const prop = parseLine(line)
    if (!prop) continue
    switch (prop.name) {
      case 'UID':
        current.uid = prop.value
        break
      case 'SUMMARY':
        current.summary = unescapeText(prop.value)
        break
      case 'DESCRIPTION':
        current.description = unescapeText(prop.value)
        break
      case 'LOCATION':
        current.location = unescapeText(prop.value)
        break
      case 'DTSTART':
        current.dtstart = { value: prop.value, params: prop.params }
        break
      case 'DTEND':
        current.dtend = { value: prop.value, params: prop.params }
        break
      case 'RRULE':
        current.rrule = prop.value
        break
      case 'EXDATE':
        for (const v of prop.value.split(',')) current.exdates.push({ value: v, params: prop.params })
        break
      case 'RECURRENCE-ID':
        current.recurrenceId = { value: prop.value, params: prop.params }
        break
      case 'STATUS':
        current.status = prop.value.toUpperCase()
        break
    }
  }
  return events
}

// ---------------------------------------------------------------------------
// Date handling
// ---------------------------------------------------------------------------

// Offset (ms to ADD to UTC to get wall time) of an IANA timezone at a moment.
function tzOffsetMs(timeZone, utcMs) {
  const parts = {}
  for (const part of new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(utcMs))) {
    parts[part.type] = part.value
  }
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  )
  return asUtc - utcMs
}

// An ICS date/date-time → { dateKey, time } in the DEVICE's timezone.
// time is '' for all-day values.
export function parseIcsDate(value, params = {}) {
  const dateMatch = /^(\d{4})(\d{2})(\d{2})$/.exec(value)
  if (dateMatch || params.VALUE === 'DATE') {
    return { dateKey: `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`, time: '' }
  }
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/.exec(value)
  if (!m) return null
  const [, y, mo, d, h, mi, s, zulu] = m
  const nums = [Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s || 0)]
  let local
  if (zulu) {
    local = new Date(Date.UTC(...nums))
  } else if (params.TZID) {
    try {
      // Wall time in TZID → UTC: subtract the zone's offset (two passes to
      // converge across DST boundaries).
      let utc = Date.UTC(...nums)
      utc = Date.UTC(...nums) - tzOffsetMs(params.TZID, utc)
      utc = Date.UTC(...nums) - tzOffsetMs(params.TZID, utc)
      local = new Date(utc)
    } catch {
      // Unknown TZID (Windows zone names etc.) — treat as local wall time.
      local = new Date(...nums)
    }
  } else {
    local = new Date(...nums) // floating: same wall time everywhere
  }
  const hh = String(local.getHours()).padStart(2, '0')
  const mm = String(local.getMinutes()).padStart(2, '0')
  return { dateKey: toDateKey(local), time: `${hh}:${mm}` }
}

// ---------------------------------------------------------------------------
// RRULE expansion
// ---------------------------------------------------------------------------

const BYDAY_INDEX = { MO: 0, TU: 1, WE: 2, TH: 3, FR: 4, SA: 5, SU: 6 }

function parseRrule(text) {
  const rule = {}
  for (const part of text.split(';')) {
    const [k, v] = part.split('=')
    if (k && v) rule[k.toUpperCase()] = v
  }
  return rule
}

const weekdayOf = (key) => {
  const [y, m, d] = key.split('-').map(Number)
  return (new Date(y, m - 1, d).getDay() + 6) % 7 // Mon=0
}
const daysApart = (a, b) => {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  return Math.round((new Date(by, bm - 1, bd) - new Date(ay, am - 1, ad)) / 86400000)
}
const dayOfMonth = (key) => Number(key.slice(8, 10))
const monthsApart = (a, b) =>
  (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + (Number(b.slice(5, 7)) - Number(a.slice(5, 7)))

// Does `key` satisfy an ordinal BYDAY like "2TU" (2nd Tuesday) or "-1FR"
// (last Friday) within its month?
function matchesOrdinalByday(key, byday) {
  const m = /^(-?\d+)([A-Z]{2})$/.exec(byday)
  if (!m) return weekdayOf(key) === BYDAY_INDEX[byday]
  const [, ordStr, dayCode] = m
  const ord = Number(ordStr)
  if (weekdayOf(key) !== BYDAY_INDEX[dayCode]) return false
  const dom = dayOfMonth(key)
  if (ord > 0) return Math.ceil(dom / 7) === ord
  // Negative: -1 = last such weekday of the month, -2 = second-last…
  const [y, mo] = key.split('-').map(Number)
  const daysInMonth = new Date(y, mo, 0).getDate()
  return Math.ceil((daysInMonth - dom + 1) / 7) === -ord
}

function rruleMatches(rule, anchorKey, key) {
  const interval = Math.max(1, Number(rule.INTERVAL) || 1)
  const freq = rule.FREQ
  if (freq === 'DAILY') {
    return daysApart(anchorKey, key) % interval === 0
  }
  if (freq === 'WEEKLY') {
    const bydays = rule.BYDAY ? rule.BYDAY.split(',') : null
    const wanted = bydays ? bydays.map((d) => BYDAY_INDEX[d]) : [weekdayOf(anchorKey)]
    if (!wanted.includes(weekdayOf(key))) return false
    const anchorMonday = addDays(anchorKey, -weekdayOf(anchorKey))
    return Math.floor(daysApart(anchorMonday, key) / 7) % interval === 0
  }
  if (freq === 'MONTHLY') {
    if (monthsApart(anchorKey, key) % interval !== 0) return false
    if (rule.BYMONTHDAY) return rule.BYMONTHDAY.split(',').map(Number).includes(dayOfMonth(key))
    if (rule.BYDAY) return rule.BYDAY.split(',').some((d) => matchesOrdinalByday(key, d))
    return dayOfMonth(key) === dayOfMonth(anchorKey)
  }
  if (freq === 'YEARLY') {
    const years = Number(key.slice(0, 4)) - Number(anchorKey.slice(0, 4))
    return years % interval === 0 && key.slice(5) === anchorKey.slice(5)
  }
  return false
}

// ---------------------------------------------------------------------------
// Expansion into occurrences
// ---------------------------------------------------------------------------

const MAX_SPAN_DAYS = 14 // cap on how many days a multi-day event repeats for
const MAX_WALK_DAYS = 3 * 366 // cap on how far a COUNT rule is walked

// Expand ICS text into [{ id, title, date, time, notes }] within
// [startKey, endKey] inclusive. Dates/times are in the device's timezone.
export function expandIcs(text, startKey, endKey) {
  const rawEvents = parseIcsEvents(text)

  // RECURRENCE-ID rows override single occurrences of their series.
  const overriddenDates = new Map() // uid -> Set of overridden dateKeys
  for (const raw of rawEvents) {
    if (!raw.recurrenceId || !raw.uid) continue
    const when = parseIcsDate(raw.recurrenceId.value, raw.recurrenceId.params)
    if (!when) continue
    if (!overriddenDates.has(raw.uid)) overriddenDates.set(raw.uid, new Set())
    overriddenDates.get(raw.uid).add(when.dateKey)
  }

  const out = []
  const push = (raw, dateKey, start) => {
    out.push({
      id: `${raw.uid || raw.summary || 'event'}-${dateKey}`,
      title: raw.summary || '(untitled)',
      date: dateKey,
      time: start.time,
      notes: raw.location || '',
    })
  }

  for (const raw of rawEvents) {
    if (!raw.dtstart || raw.status === 'CANCELLED') continue
    const start = parseIcsDate(raw.dtstart.value, raw.dtstart.params)
    if (!start) continue

    // Override rows stand alone as single occurrences.
    if (raw.recurrenceId) {
      if (start.dateKey >= startKey && start.dateKey <= endKey) push(raw, start.dateKey, start)
      continue
    }

    if (raw.rrule) {
      const rule = parseRrule(raw.rrule)
      const exdates = new Set(
        raw.exdates.map((e) => parseIcsDate(e.value, e.params)?.dateKey).filter(Boolean),
      )
      const overrides = overriddenDates.get(raw.uid) || new Set()
      const until = rule.UNTIL ? parseIcsDate(rule.UNTIL, {})?.dateKey : null
      const count = rule.COUNT ? Number(rule.COUNT) : null
      // COUNT rules must be walked from the series start to count correctly;
      // otherwise skip straight to the window.
      let key = count ? start.dateKey : start.dateKey > startKey ? start.dateKey : startKey
      let made = 0
      const hardStop = addDays(start.dateKey, MAX_WALK_DAYS)
      for (; key <= endKey && key <= hardStop; key = addDays(key, 1)) {
        if (until && key > until) break
        if (!rruleMatches(rule, start.dateKey, key)) continue
        if (!exdates.has(key)) {
          made++
          if (key >= startKey && !overrides.has(key)) push(raw, key, start)
        } else {
          made++ // an excluded date still consumes a COUNT slot
        }
        if (count && made >= count) break
      }
      continue
    }

    // Single events; all-day ones may span several days (DTEND is exclusive).
    let span = 1
    if (!start.time && raw.dtend) {
      const end = parseIcsDate(raw.dtend.value, raw.dtend.params)
      if (end) span = Math.max(1, Math.min(MAX_SPAN_DAYS, daysApart(start.dateKey, end.dateKey)))
    }
    for (let i = 0; i < span; i++) {
      const key = addDays(start.dateKey, i)
      if (key >= startKey && key <= endKey) push(raw, key, start)
    }
  }
  return out
}
