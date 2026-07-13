// Date helpers. Dates are passed around as "date keys" — local-timezone
// YYYY-MM-DD strings — so they can live in JSON and compare lexically.

export function toDateKey(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function parseDateKey(key) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function todayKey() {
  return toDateKey(new Date())
}

export function addDays(key, delta) {
  const date = parseDateKey(key)
  date.setDate(date.getDate() + delta)
  return toDateKey(date)
}

// "Mon 14 Jul" (weekday: true) or "14 July 2026" (long: true) or "14 Jul".
export function formatDateKey(key, { weekday = false, long = false } = {}) {
  const date = parseDateKey(key)
  if (long) {
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  }
  return date.toLocaleDateString('en-GB', {
    ...(weekday ? { weekday: 'short' } : {}),
    day: 'numeric',
    month: 'short',
  })
}

export function monthLabel(monthDate) {
  return monthDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

export function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export function addMonths(monthDate, delta) {
  return new Date(monthDate.getFullYear(), monthDate.getMonth() + delta, 1)
}

// A Monday-first grid of full weeks covering the month: an array of weeks,
// each week an array of 7 { key, dayNumber, inMonth } cells.
export function monthGrid(monthDate) {
  const first = startOfMonth(monthDate)
  const start = new Date(first)
  start.setDate(first.getDate() - ((first.getDay() + 6) % 7)) // back to Monday

  const weeks = []
  const cursor = new Date(start)
  do {
    const week = []
    for (let i = 0; i < 7; i++) {
      week.push({
        key: toDateKey(cursor),
        dayNumber: cursor.getDate(),
        inMonth: cursor.getMonth() === monthDate.getMonth(),
      })
      cursor.setDate(cursor.getDate() + 1)
    }
    weeks.push(week)
  } while (cursor.getMonth() === monthDate.getMonth())
  return weeks
}

// Events on or after fromKey within the next `days` days, soonest first.
// Untimed events sort after timed ones on the same day.
export function upcomingEvents(events, fromKey, days) {
  const lastKey = addDays(fromKey, days - 1)
  return events
    .filter((e) => e.date >= fromKey && e.date <= lastKey)
    .sort((a, b) =>
      a.date === b.date
        ? (a.time || '99:99').localeCompare(b.time || '99:99')
        : a.date.localeCompare(b.date),
    )
}

// A friendly age from a date-of-birth key: "4 mo", "1", "7".
export function ageFromDob(dobKey, onKey = todayKey()) {
  if (!dobKey) return null
  const dob = parseDateKey(dobKey)
  const on = parseDateKey(onKey)
  let months = (on.getFullYear() - dob.getFullYear()) * 12 + (on.getMonth() - dob.getMonth())
  if (on.getDate() < dob.getDate()) months -= 1
  if (months < 0) return null
  if (months < 24) return `${months} mo`
  return String(Math.floor(months / 12))
}
