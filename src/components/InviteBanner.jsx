import { useState } from 'react'
import { Users, X } from 'lucide-react'
import { friendlyHouseholdError, joinHousehold } from '../lib/household.js'

// Shown when the app was opened via an invite link (?join=CODE) and the user
// is signed in: one tap to join the shared family hub.
export default function InviteBanner({ code, onJoined, onDismiss }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const join = async () => {
    setBusy(true)
    setError(null)
    try {
      await joinHousehold(code)
      onJoined()
    } catch (err) {
      setError(friendlyHouseholdError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="invite-banner" role="status">
      <Users size={20} aria-hidden="true" />
      <div className="invite-banner-main">
        <strong>You've been invited to a shared family hub</strong>
        <span className="muted">
          Join to share the same calendar, to-dos, documents and photos.
        </span>
        {error && <span className="invite-error">{error}</span>}
      </div>
      <button type="button" className="primary-button" disabled={busy} onClick={join}>
        {busy ? 'Joining…' : 'Join'}
      </button>
      <button type="button" className="icon-button" aria-label="Dismiss invitation" onClick={onDismiss}>
        <X size={18} />
      </button>
    </div>
  )
}
