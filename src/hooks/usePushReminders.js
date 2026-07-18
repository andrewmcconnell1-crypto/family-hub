import { useCallback, useEffect, useState } from 'react'
import {
  currentPushSubscription,
  disablePushReminders,
  enablePushReminders,
  isMissingTableError,
  pushBlocker,
} from '../lib/push.js'

// Reminder-notification state for the settings card. `status` is one of:
//   checking | ios-install | unsupported | denied | off | on
export function usePushReminders(user) {
  const [status, setStatus] = useState('checking')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [setupNeeded, setSetupNeeded] = useState(false)

  useEffect(() => {
    let active = true
    const check = async () => {
      const blocker = pushBlocker()
      if (blocker) {
        if (active) setStatus(blocker)
        return
      }
      const subscription = await currentPushSubscription().catch(() => null)
      if (active) setStatus(subscription ? 'on' : 'off')
    }
    check()
    return () => {
      active = false
    }
  }, [user?.id])

  const enable = useCallback(async () => {
    if (!user) return
    setBusy(true)
    setError(null)
    try {
      await enablePushReminders(user.id)
      setStatus('on')
    } catch (err) {
      if (isMissingTableError(err)) setSetupNeeded(true)
      else if (err?.message === 'permission-denied') setStatus('denied')
      else setError("Couldn't turn reminders on — check your connection and try again.")
      if (err?.message !== 'permission-denied') console.error('Enabling reminders failed', err)
    } finally {
      setBusy(false)
    }
  }, [user])

  const disable = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      await disablePushReminders()
      setStatus('off')
    } catch (err) {
      console.error('Disabling reminders failed', err)
      setError("Couldn't turn reminders off — try again.")
    } finally {
      setBusy(false)
    }
  }, [])

  return { status, busy, error, setupNeeded, enable, disable }
}
