import { Bell, BellOff } from 'lucide-react'
import { usePushReminders } from '../hooks/usePushReminders.js'

// Settings card: turn the morning-digest push notification on/off for this
// device. Needs the server side from supabase/reminders-setup.md.
export default function RemindersCard({ user }) {
  const reminders = usePushReminders(user)

  return (
    <section className="card">
      <h2>Reminders</h2>
      <p className="muted">
        A morning notification on this device with the day ahead — events, to-dos due, and
        documents about to expire. Nothing on? No notification.
      </p>

      {reminders.status === 'ios-install' && (
        <p className="muted">
          On iPhone, reminders need the app on your Home Screen first: share button →{' '}
          <strong>Add to Home Screen</strong>, then open Treehouse from there.
        </p>
      )}
      {reminders.status === 'unsupported' && (
        <p className="muted">This browser doesn't support notifications.</p>
      )}
      {reminders.status === 'denied' && (
        <p className="muted">
          Notifications are blocked for Treehouse in your device settings — allow them there, then
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
