// Fetching + caching for subscribed external calendars (Google/Outlook/iCloud
// ".ics" feeds). Those feeds don't send CORS headers, so in the normal
// signed-in case we fetch them through the ics-proxy edge function; when
// that's unavailable we try a direct fetch (works for the few feeds that do
// allow it). Fetched text is cached per device in localStorage so calendars
// render instantly and keep working offline.

import { supabase } from './supabase.js'

const CACHE_PREFIX = 'treehouse:ical:'
export const REFRESH_AFTER_MS = 3 * 60 * 60 * 1000 // 3 hours

const cacheKey = (id) => `${CACHE_PREFIX}${id}`

export function readCachedCalendar(id) {
  try {
    const raw = localStorage.getItem(cacheKey(id))
    return raw ? JSON.parse(raw) : null // { url, fetchedAt, text }
  } catch {
    return null
  }
}

export function writeCachedCalendar(id, entry) {
  try {
    localStorage.setItem(cacheKey(id), JSON.stringify(entry))
  } catch {
    // Quota — a calendar that won't cache still works while online.
  }
}

export function clearCachedCalendar(id) {
  try {
    localStorage.removeItem(cacheKey(id))
  } catch {
    // ignore
  }
}

// Friendly message for a proxy error code (see supabase/functions/ics-proxy).
export function calendarErrorMessage(code) {
  switch (code) {
    case 'invalid-url':
      return "That doesn't look like a valid link."
    case 'unsupported-scheme':
      return 'Use an https:// or webcal:// calendar link.'
    case 'blocked-host':
      return "That address isn't allowed."
    case 'not-a-calendar':
      return "That link didn't return a calendar — check you copied the secret iCal / .ics address."
    case 'timeout':
      return 'The calendar took too long to respond — try again.'
    case 'signed-out':
      return 'Sign in to subscribe to external calendars.'
    default:
      return "Couldn't reach that calendar — check the link and your connection."
  }
}

// Fetch a feed's raw ICS text. Throws an Error whose message is one of the
// codes above on failure.
export async function fetchCalendarText(url) {
  if (supabase) {
    const { data: session } = await supabase.auth.getSession()
    if (!session?.session) throw new Error('signed-out')
    const { data, error } = await supabase.functions.invoke('ics-proxy', { body: { url } })
    if (error) {
      // The function's JSON error body rides along on the FunctionsHttpError.
      let code = 'fetch-error'
      try {
        code = (await error.context?.json())?.error || code
      } catch {
        // no structured body
      }
      throw new Error(code)
    }
    if (typeof data === 'string') return data
    if (data?.error) throw new Error(data.error)
    throw new Error('fetch-error')
  }
  // Local-only mode: best-effort direct fetch (CORS permitting).
  const res = await fetch(url.replace(/^webcal:\/\//i, 'https://'))
  if (!res.ok) throw new Error('fetch-failed')
  const text = await res.text()
  if (!text.includes('BEGIN:VCALENDAR')) throw new Error('not-a-calendar')
  return text
}
