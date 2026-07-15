// Recurring-event expansion. An event's `date` is its anchor (first) date;
// `repeat` is one of REPEAT_OPTIONS; weekly/fortnightly repeats can pick
// multiple weekdays; `endDate` optionally stops the series; `exceptions`
// lists occurrence dates that were individually deleted ("skip this day").
// Birthdays are synthesised straight from family members' dates of birth.

import { addDays, parseDateKey } from './dateUtils.js'

export const REPEAT_OPTIONS = [
  { id: 'none', label: "Doesn't repeat" },
  { id: 'weekly', label: 'Weekly' },
  { id: 'fortnightly', label: 'Fortnightly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'yearly', label: 'Yearly' },
]

export const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// Monday = 0 … Sunday = 6, matching the calendar grid.
export function weekdayIndex(key) {
  return (parseDateKey(key).getDay() + 6) % 7
}

function daysBetween(fromKey, toKey) {
  return Math.round((parseDateKey(toKey) - parseDateKey(fromKey)) / 86400000)
}

function eventWeekdays(event) {
  const days = Array.isArray(event.weekdays) ? event.weekdays : []
  return days.length > 0 ? days : [weekdayIndex(event.date)]
}

function matchesRepeat(event, key) {
  const anchor = parseDateKey(event.date)
  const day = parseDateKey(key)
  switch (event.repeat) {
    case 'weekly':
      return eventWeekdays(event).includes(weekdayIndex(key))
    case 'fortnightly': {
      if (!eventWeekdays(event).includes(weekdayIndex(key))) return false
      // Same week-parity as the anchor's week (weeks start Monday).
      const anchorMonday = addDays(event.date, -weekdayIndex(event.date))
      const weeks = Math.floor(daysBetween(anchorMonday, key) / 7)
      return weeks % 2 === 0
    }
    case 'monthly':
      return day.getDate() === anchor.getDate()
    case 'yearly':
      return day.getDate() === anchor.getDate() && day.getMonth() === anchor.getMonth()
    default:
      return false
  }
}

// Expand events into dated occurrences within [startKey, endKey], inclusive.
// Each occurrence carries the series' fields with `date` set to the occurrence
// day, plus seriesDate for reference. Ranges are calendar-sized (a month or a
// week), so a simple day walk is plenty fast.
export function occurrencesInRange(events, startKey, endKey) {
  const out = []
  for (const event of events) {
    if (!event.repeat || event.repeat === 'none') {
      if (event.date >= startKey && event.date <= endKey) {
        out.push({ ...event, seriesDate: event.date })
      }
      continue
    }
    const from = event.date > startKey ? event.date : startKey
    const to = event.endDate && event.endDate < endKey ? event.endDate : endKey
    const exceptions = Array.isArray(event.exceptions) ? event.exceptions : []
    for (let key = from; key <= to; key = addDays(key, 1)) {
      if (matchesRepeat(event, key) && !exceptions.includes(key)) {
        out.push({ ...event, date: key, seriesDate: event.date })
      }
    }
  }
  return out
}

// Birthday occurrences synthesised from members' dates of birth.
export function birthdayOccurrences(children, startKey, endKey) {
  const out = []
  for (const child of children) {
    if (!child.dob) continue
    const dob = parseDateKey(child.dob)
    const startYear = parseDateKey(startKey).getFullYear()
    const endYear = parseDateKey(endKey).getFullYear()
    for (let year = startYear; year <= endYear; year++) {
      const age = year - dob.getFullYear()
      if (age < 1) continue
      const month = String(dob.getMonth() + 1).padStart(2, '0')
      const dayOfMonth = String(dob.getDate()).padStart(2, '0')
      const key = `${year}-${month}-${dayOfMonth}`
      if (key < startKey || key > endKey) continue
      out.push({
        id: `birthday-${child.id}-${year}`,
        title: `${child.name} turns ${age} 🎂`,
        date: key,
        time: '',
        category: 'birthday',
        childIds: [child.id],
        notes: '',
        repeat: 'none',
        isBirthday: true,
      })
    }
  }
  return out
}

function byDateThenTime(a, b) {
  return a.date === b.date
    ? (a.time || '99:99').localeCompare(b.time || '99:99')
    : a.date.localeCompare(b.date)
}

// Everything the calendar/home should show for a range: real events expanded
// into occurrences, plus birthdays, soonest first.
export function calendarOccurrences(data, startKey, endKey) {
  return [
    ...occurrencesInRange(data.events, startKey, endKey),
    ...birthdayOccurrences(data.children, startKey, endKey),
  ].sort(byDateThenTime)
}
