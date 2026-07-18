import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { expandIcs } from '../lib/ical.js'
import {
  REFRESH_AFTER_MS,
  fetchCalendarText,
  readCachedCalendar,
  writeCachedCalendar,
} from '../lib/externalCalendars.js'

// Manages subscribed external calendars: loads cached ICS immediately, then
// refreshes stale/changed feeds in the background, and exposes a stable
// `occurrencesInRange` the calendar views merge in read-only.
//
// `calendars` is data.externalCalendars (synced list of {id,name,url,colorId}).
// Returns:
//   feeds        Map id -> { text, fetchedAt, status, error }
//   status(id)   'loading' | 'ok' | 'error' (per calendar, for the UI)
//   occurrencesInRange(startKey, endKey) -> tagged external occurrences
//   refresh(id?) force-refetch one or all
export function useExternalCalendars(calendars) {
  // id -> { text, fetchedAt, status: 'loading'|'ok'|'error', error }
  const [feeds, setFeeds] = useState(() => new Map())
  // Guard so a given fetch runs once at a time per calendar.
  const inFlight = useRef(new Set())

  const list = useMemo(() => calendars || [], [calendars])

  const loadOne = useCallback(async (cal, { force = false } = {}) => {
    if (inFlight.current.has(cal.id)) return
    const cached = readCachedCalendar(cal.id)
    const fresh =
      cached && cached.url === cal.url && Date.now() - (cached.fetchedAt || 0) < REFRESH_AFTER_MS
    // Seed from cache (even when stale) so something shows straight away.
    if (cached && cached.url === cal.url) {
      setFeeds((prev) => {
        const next = new Map(prev)
        const existing = next.get(cal.id)
        if (!existing || existing.text !== cached.text) {
          next.set(cal.id, { text: cached.text, fetchedAt: cached.fetchedAt, status: 'ok' })
        }
        return next
      })
    }
    if (fresh && !force) return

    inFlight.current.add(cal.id)
    setFeeds((prev) => {
      const next = new Map(prev)
      const existing = next.get(cal.id)
      next.set(cal.id, { ...existing, status: existing?.text ? 'ok' : 'loading', error: null })
      return next
    })
    try {
      const text = await fetchCalendarText(cal.url)
      const entry = { url: cal.url, text, fetchedAt: Date.now() }
      writeCachedCalendar(cal.id, entry)
      setFeeds((prev) => {
        const next = new Map(prev)
        next.set(cal.id, { text, fetchedAt: entry.fetchedAt, status: 'ok', error: null })
        return next
      })
    } catch (err) {
      setFeeds((prev) => {
        const next = new Map(prev)
        const existing = next.get(cal.id)
        // Keep any cached text visible; just flag the error.
        next.set(cal.id, { ...existing, status: 'error', error: err.message || 'fetch-error' })
        return next
      })
    } finally {
      inFlight.current.delete(cal.id)
    }
  }, [])

  // Load whenever the set of calendars (ids/urls) changes.
  const signature = list.map((c) => `${c.id}:${c.url}`).join('|')
  useEffect(() => {
    for (const cal of list) loadOne(cal)
    // Drop feed state for removed calendars.
    setFeeds((prev) => {
      const ids = new Set(list.map((c) => c.id))
      let changed = false
      const next = new Map()
      for (const [id, value] of prev) {
        if (ids.has(id)) next.set(id, value)
        else changed = true
      }
      return changed ? next : prev
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, loadOne])

  // Refresh stale feeds when the app is re-focused.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        for (const cal of list) loadOne(cal)
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [list, loadOne])

  const refresh = useCallback(
    (id) => {
      for (const cal of list) {
        if (!id || cal.id === id) loadOne(cal, { force: true })
      }
    },
    [list, loadOne],
  )

  const status = useCallback(
    (id) => feeds.get(id)?.status || 'loading',
    [feeds],
  )

  // Expand every calendar's cached ICS over [startKey,endKey], tagging each
  // occurrence with its calendar for colour/label. Stable per feeds+range.
  const occurrencesInRange = useCallback(
    (startKey, endKey) => {
      const out = []
      for (const cal of list) {
        const feed = feeds.get(cal.id)
        if (!feed?.text) continue
        let expanded
        try {
          expanded = expandIcs(feed.text, startKey, endKey)
        } catch {
          continue
        }
        for (const occ of expanded) {
          out.push({
            ...occ,
            category: 'external',
            childIds: [],
            documentIds: [],
            repeat: 'none',
            isExternal: true,
            calendarId: cal.id,
            calendarName: cal.name,
            calendarColorId: cal.colorId,
          })
        }
      }
      return out
    },
    [feeds, list],
  )

  return { feeds, status, occurrencesInRange, refresh }
}
