import { useCallback, useEffect, useRef, useState } from 'react'
import { App as CapacitorApp } from '@capacitor/app'
import { authenticate, isLockEnabled, isNativeApp } from '../lib/appLock.js'

// Grace period: don't re-lock if you were only away briefly (glancing at a
// notification, copying a code from another app).
const RELOCK_AFTER_MS = 15000

// Drives the app-lock gate. Starts locked when the lock is enabled on a native
// device; re-locks after the app has been in the background a while.
export function useAppLock() {
  const [locked, setLocked] = useState(() => isLockEnabled())
  const backgroundedAt = useRef(0)
  const wasBackgrounded = useRef(false)

  useEffect(() => {
    if (!isNativeApp()) return undefined
    let handle
    CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) {
        backgroundedAt.current = Date.now()
        wasBackgrounded.current = true
        return
      }
      // Only re-lock if we genuinely returned from the background after the
      // grace period — never on a stray "active" event mid-use.
      if (wasBackgrounded.current && isLockEnabled() && Date.now() - backgroundedAt.current > RELOCK_AFTER_MS) {
        setLocked(true)
      }
      wasBackgrounded.current = false
    }).then((h) => {
      handle = h
    })
    return () => handle?.remove()
  }, [])

  const unlock = useCallback(async () => {
    const ok = await authenticate()
    if (ok) setLocked(false)
    return ok
  }, [])

  // Called by the settings toggle so enabling the lock takes effect immediately.
  const relock = useCallback(() => setLocked(true), [])

  return { locked, unlock, relock }
}
