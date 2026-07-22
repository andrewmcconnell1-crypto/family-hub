import { useEffect, useState } from 'react'
import { Bell, BellOff, BellRing } from 'lucide-react'
import { usePushReminders } from '../hooks/usePushReminders.js'
import {
  ensureNativePermission,
  isNativeApp,
  syncNativeReminders,
  upcomingReminders,
} from '../lib/nativeReminders.js'

// Settings card for reminders. In the native Android app this manages
// on-device alarms (reliable in Doze); in a browser it manages web-push
// notifications (the morning digest + per-event nudges).
export default function RemindersCard({ user, data }) {
  if (isNativeApp()) return <NativeReminders data={data} />
  return <WebReminders user={user} />
}

// --- Native Android shell: real on-device alarms --------------------------
function NativeReminders({ data }) {
  const [status, setStatus] = useState('checking') // checking | off | on | blocked
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    ensureNativePermission()
      .then((granted) => active && setStatus(granted ? 'on' : 'off'))
      .catch(() => active && setStatus('off'))
    return () => {
      active = false
    }
  }, [])

  // Re-arm whenever this card is shown with reminders granted, so the count
  // shown reflects what's actually scheduled.
  useEffect(() => {
    if (status === 'on' && data) syncNativeReminders(data).catch(() => {})
  }, [status, data])

  const armed = data ? upcomingReminders(data).length : 0

  const turnOn = async () => {
    setBusy(true)
    try {
      const granted = await ensureNativePermission()
      if (!granted) {
        setStatus('blocked')
        return
      }
      await syncNativeReminders(data)
      setStatus('on')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card">
      <h2>Reminders</h2>
      {status === 'on' ? (
        <p className="setup-status">
          <BellRing size={16} aria-hidden="true" /> On
          {armed > 0 && <span className="muted"> · {armed} upcoming armed</span>}
        </p>
      ) : (
        <p className="muted">
          Real on-device alarms — they ring even with no signal. Set one per event, or on a to-do
          with “Remind me on the due date”.
        </p>
      )}

      {status === 'blocked' && (
        <p className="muted">
          Notifications are blocked in Android settings — allow them for Nest, then reopen.
        </p>
      )}

      {(status === 'off' || status === 'blocked') && (
        <button type="button" className="primary-button" disabled={busy} onClick={turnOn}>
          <Bell size={16} aria-hidden="true" /> Turn on reminders
        </button>
      )}
    </section>
  )
}

// --- Browser: web-push notifications --------------------------------------
function WebReminders({ user }) {
  const reminders = usePushReminders(user)

  return (
    <section className="card">
      <h2>Reminders</h2>
      <p className="muted">
        A nudge before events with a reminder set, a ping when a to-do is due, and a morning
        digest — on this device.
      </p>

      {reminders.status === 'ios-install' && (
        <p className="muted">
          On iPhone, reminders need the app on your Home Screen first: share button →{' '}
          <strong>Add to Home Screen</strong>, then open Nest from there.
        </p>
      )}
      {reminders.status === 'unsupported' && (
        <p className="muted">This browser doesn't support notifications.</p>
      )}
      {reminders.status === 'denied' && (
        <p className="muted">
          Notifications are blocked for Nest in your device settings — allow them there, then
          come back.
        </p>
      )}

      {(reminders.status === 'off' || reminders.status === 'on') && (
        <button
          type="button"
          className="primary-button"
          disabled={reminders.busy}
          onClick={reminders.status === 'on' ? reminders.disable : reminders.enable}
        >
          {reminders.status === 'on' ? (
            <>
              <BellOff size={16} aria-hidden="true" /> Turn off on this device
            </>
          ) : (
            <>
              <Bell size={16} aria-hidden="true" /> Turn on reminders
            </>
          )}
        </button>
      )}

      {reminders.setupNeeded && (
        <p className="muted">
          One-time server step needed: follow <code>supabase/reminders-setup.md</code>, then try
          again.
        </p>
      )}
      {reminders.error && <p className="invite-error">{reminders.error}</p>}
    </section>
  )
}
