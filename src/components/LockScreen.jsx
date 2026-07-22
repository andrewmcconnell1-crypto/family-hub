import { useState } from 'react'
import { Lock } from 'lucide-react'

// Full-screen gate shown while the app is locked. Unlocking is driven by a
// button tap (a real user gesture, after the app has loaded) rather than an
// automatic prompt on mount — auto-prompting raced the native bridge and could
// hang on "Unlocking…" after the OS had already accepted. A safety timeout
// re-enables the button so it can never get permanently stuck.
export default function LockScreen({ onUnlock }) {
  const [busy, setBusy] = useState(false)

  const unlock = async () => {
    if (busy) return
    setBusy(true)
    const safety = setTimeout(() => setBusy(false), 20000)
    try {
      const ok = await onUnlock()
      if (!ok) setBusy(false) // success unmounts this screen; only reset on failure
    } catch {
      setBusy(false)
    } finally {
      clearTimeout(safety)
    }
  }

  return (
    <div className="lockscreen">
      <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" width="72" height="72" />
      <h1>Nest is locked</h1>
      <p className="muted">Unlock with your fingerprint, face, or device PIN.</p>
      <button type="button" className="primary-button" disabled={busy} onClick={unlock}>
        <Lock size={16} aria-hidden="true" /> {busy ? 'Unlocking…' : 'Unlock'}
      </button>
    </div>
  )
}
