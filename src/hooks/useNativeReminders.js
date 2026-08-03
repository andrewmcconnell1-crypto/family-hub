import { useEffect, useRef } from 'react'
import {
  isNativeApp,
  registerNativeTapHandler,
  syncNativeReminders,
} from '../lib/nativeReminders.js'

// Keeps the native app's on-device alarms in step with the family data.
//
// In a normal browser this does nothing (isNativeApp() is false) and the app
// falls back to web push. Inside the Nest Android shell it (re)schedules real
// local notifications whenever the events/to-dos change, so a reminder set on
// one device is armed on this one the next time it syncs and opens.
export function useNativeReminders(data) {
  // Re-sync when the parts of the data that affect reminders change. Stringify
  // just those fields so unrelated edits (a new photo, say) don't churn the
  // OS's alarm list.
  const signature = data
    ? JSON.stringify(
        (data.events || []).map((e) => [e.id, e.date, e.time, e.reminders, e.reminder, e.repeat, e.endDate, e.weekdays, e.exceptions]),
      ) +
      '|' +
      JSON.stringify((data.todos || []).map((t) => [t.id, t.dueDate, t.remind, t.done]))
    : ''
  const lastSig = useRef(null)

  useEffect(() => {
    if (!isNativeApp() || !data) return
    if (lastSig.current === signature) return
    lastSig.current = signature
    registerNativeTapHandler()
    syncNativeReminders(data).catch((err) => console.error('Native reminder sync failed', err))
  }, [data, signature])
}
