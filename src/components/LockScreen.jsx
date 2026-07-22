import { useEffect, useState } from 'react'
import { Lock } from 'lucide-react'

// Full-screen gate shown while the app is locked. Prompts for biometrics/PIN
// automatically on mount, with a manual retry if the sheet is dismissed.
export default function LockScreen({ onUnlock }) {
  const [busy, setBusy] = useState(true)

  useEffect(() => {
    let cancelled = false
    onUnlock().finally(() => {
      if (!cancelled) setBusy(false)
    })
    return () => {
      cancelled = true
    }
  }, [onUnlock])

  const retry = async () => {
    setBusy(true)
    const ok = await onUnlock()
    if (!ok) setBusy(false)
  }

  return (
    <div className="lockscreen">
      <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" width="72" height="72" />
      <h1>Nest is locked</h1>
      <p className="muted">Unlock with your fingerprint, face, or device PIN.</p>
      <button type="button" className="primary-button" disabled={busy} onClick={retry}>
        <Lock size={16} aria-hidden="true" /> {busy ? 'Unlocking…' : 'Unlock'}
      </button>
    </div>
  )
}
