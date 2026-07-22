import { useEffect, useState } from 'react'
import { Lock, LockOpen } from 'lucide-react'
import { authenticate, canAuthenticate, isLockEnabled, isNativeApp, setLockEnabled } from '../lib/appLock.js'

// Settings card (native app only): turn the fingerprint/PIN app lock on or off.
// Enabling runs a test unlock so we know it works; disabling requires an unlock
// so it can't be switched off by someone who's picked up an open phone.
export default function AppLockCard() {
  const [enabled, setEnabled] = useState(isLockEnabled())
  const [available, setAvailable] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    canAuthenticate().then(setAvailable)
  }, [])

  if (!isNativeApp()) return null

  const toggle = async () => {
    setBusy(true)
    setError(null)
    try {
      if (!enabled && !(await canAuthenticate())) {
        setError('Set up a fingerprint, face unlock or screen PIN in Android settings first.')
        return
      }
      const ok = await authenticate()
      if (!ok) {
        setError('Couldn’t confirm it’s you — nothing changed.')
        return
      }
      setLockEnabled(!enabled)
      setEnabled(!enabled)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card">
      <h2>App lock</h2>
      <p className="muted">
        Require your fingerprint, face, or device PIN to open Nest on this device — a private
        layer over the family’s documents and photos.
      </p>
      {!available && (
        <p className="muted">
          This device has no screen lock set up yet. Add a fingerprint or PIN in Android settings
          to use this.
        </p>
      )}
      <button type="button" className="primary-button" disabled={busy} onClick={toggle}>
        {enabled ? (
          <>
            <LockOpen size={16} aria-hidden="true" /> Turn off app lock
          </>
        ) : (
          <>
            <Lock size={16} aria-hidden="true" /> Turn on app lock
          </>
        )}
      </button>
      {error && <p className="invite-error">{error}</p>}
    </section>
  )
}
