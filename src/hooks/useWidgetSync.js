import { useEffect, useRef } from 'react'
import { App as CapacitorApp } from '@capacitor/app'
import { isWidgetHost, pushWidget } from '../lib/nestWidget.js'

// Keeps the home-screen widget's "today" list in step with the app. Pushes when
// the events/to-dos change, and again whenever the app returns to the
// foreground so the date (and what counts as "today") stays current. No-op in a
// browser.
export function useWidgetSync(data) {
  const signature = data
    ? JSON.stringify((data.events || []).map((e) => [e.id, e.date, e.time, e.title, e.repeat, e.endDate, e.weekdays, e.exceptions])) +
      '|' +
      JSON.stringify((data.todos || []).map((t) => [t.id, t.dueDate, t.done, t.title])) +
      '|' +
      JSON.stringify((data.children || []).map((c) => [c.id, c.name, c.dob]))
    : ''
  const dataRef = useRef(data)
  useEffect(() => {
    dataRef.current = data
  })

  useEffect(() => {
    if (!isWidgetHost() || !data) return
    pushWidget(data)
  }, [data, signature])

  useEffect(() => {
    if (!isWidgetHost()) return undefined
    let handle
    CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive && dataRef.current) pushWidget(dataRef.current)
    }).then((h) => {
      handle = h
    })
    return () => handle?.remove()
  }, [])
}
