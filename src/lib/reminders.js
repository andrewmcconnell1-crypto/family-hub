// Which per-event / per-to-do reminders fall due inside a time window.
//
// The send-due-reminders edge function runs every ~15 minutes and asks: since
// I last ran, whose reminder time has passed? This is that pure calculation,
// unit-tested here and mirrored (in TypeScript) in the edge function.
//
// Times in the data are local wall-clock (a date key + "HH:MM", no zone), so
// we convert them to absolute UTC milliseconds using the household's timezone
// before comparing against the window.

import { eventReminders, reminderLeadLabel } from './familyData.js'
import { occurrencesInRange } from '../utils/recurrence.js'
import { toDateKey } from '../utils/dateUtils.js'

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

// A local wall time (date key + "HH:MM") in `tz` → absolute UTC ms.
export function localWallToUtcMs(dateKey, time, tz) {
  const [y, m, d] = dateKey.split('-').map(Number)
  const [hh, mm] = (time || '00:00').split(':').map(Number)
  const naiveUtc = Date.UTC(y, m - 1, d, hh, mm)
  // Two passes so we land on the right side of a DST transition.
  let utc = naiveUtc - tzOffsetMs(tz, naiveUtc)
  utc = naiveUtc - tzOffsetMs(tz, utc)
  return utc
}

// Reminders whose fire time is in (windowStartMs, windowEndMs]. Each result:
//   { key, title, body } — key is a stable dedupe id.
// todoHour is the local hour (0-23) a to-do due-date reminder fires at.
export function collectDueReminders(
  data,
  { tz = 'UTC', windowStartMs, windowEndMs, todoHour = 9 },
) {
  const out = []

  // Expand event occurrences generously around the window so a "1 day before"
  // reminder for an event just past the window's far edge is still caught.
  const startKey = toDateKey(new Date(windowStartMs - 2 * 86400000))
  const endKey = toDateKey(new Date(windowEndMs + 2 * 86400000))
  for (const occ of occurrencesInRange(data.events || [], startKey, endKey)) {
    if (!occ.time) continue
    const startMs = localWallToUtcMs(occ.date, occ.time, tz)
    for (const mins of eventReminders(occ)) {
      const fireMs = startMs - mins * 60000
      if (fireMs > windowStartMs && fireMs <= windowEndMs) {
        out.push({
          key: `evt:${occ.id}:${occ.date}:${mins}`,
          title: occ.title,
          body: `${occ.time} · ${reminderLeadLabel(mins)}`,
        })
      }
    }
  }

  const hh = String(todoHour).padStart(2, '0')
  for (const todo of data.todos || []) {
    if (!todo.remind || todo.done || !todo.dueDate) continue
    const fireMs = localWallToUtcMs(todo.dueDate, `${hh}:00`, tz)
    if (fireMs > windowStartMs && fireMs <= windowEndMs) {
      out.push({ key: `todo:${todo.id}:${todo.dueDate}`, title: 'To-do due today', body: todo.title })
    }
  }

  return out
}
