import { useEffect, useState } from 'react'
import { CalendarPlus, Copy } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import { isMissingTableError } from '../lib/push.js'

const feedUrlFor = (token) =>
  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/calendar-feed?token=${token}`

const randomToken = () => {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

// Settings card: a private ICS link other calendar apps can subscribe to, so
// Nest events (recurring ones included, plus birthdays) show up in
// Google Calendar / Apple Calendar. Served by the calendar-feed edge function.
export default function CalendarFeedCard({ user }) {
  const [token, setToken] = useState(null) // null = loading, '' = none yet
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [setupNeeded, setSetupNeeded] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    supabase
      .from('calendar_feeds')
      .select('token')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data, error: err }) => {
        if (!active) return
        if (err && isMissingTableError(err)) setSetupNeeded(true)
        setToken(data?.token || '')
      })
    return () => {
      active = false
    }
  }, [user.id])

  const saveToken = async (value) => {
    setBusy(true)
    setError(null)
    try {
      if (value) {
        const { error: err } = await supabase
          .from('calendar_feeds')
          .upsert({ user_id: user.id, token: value }, { onConflict: 'user_id' })
        if (err) throw err
      } else {
        const { error: err } = await supabase.from('calendar_feeds').delete().eq('user_id', user.id)
        if (err) throw err
      }
      setToken(value)
      setCopied(false)
    } catch (err) {
      if (isMissingTableError(err)) setSetupNeeded(true)
      else {
        console.error('Calendar feed update failed', err)
        setError("Couldn't update the feed link — check your connection and try again.")
      }
    } finally {
      setBusy(false)
    }
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(feedUrlFor(token))
      setCopied(true)
    } catch {
      // Clipboard unavailable — the URL is on screen to copy by hand.
    }
  }

  if (token === null) return null

  return (
    <section className="card">
      <h2>Calendar feed</h2>
      <p className="muted">
        See Nest events inside Google Calendar or Apple Calendar: create your private link,
        then subscribe to it from the other calendar. It updates automatically (calendar apps
        refresh subscribed feeds every few hours).
      </p>

      {setupNeeded && (
        <p className="muted">
          One-time server step needed: follow <code>supabase/reminders-setup.md</code>, then
          reload.
        </p>
      )}

      {!setupNeeded && token === '' && (
        <button
          type="button"
          className="primary-button"
          disabled={busy}
          onClick={() => saveToken(randomToken())}
        >
          <CalendarPlus size={16} aria-hidden="true" /> Create feed link
        </button>
      )}

      {!setupNeeded && token && (
        <>
          <div className="feed-url-row">
            <code className="feed-url">{feedUrlFor(token)}</code>
            <button type="button" className="primary-button" onClick={copy}>
              <Copy size={16} aria-hidden="true" /> {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <p className="muted">
            Google Calendar: Settings → <strong>Add calendar → From URL</strong> → paste.
            iPhone/Mac Calendar: <strong>Add Subscription Calendar</strong> → paste. Anyone with
            this link can read your calendar, so treat it like a password.
          </p>
          <div className="feed-actions">
            <button
              type="button"
              className="link-button"
              disabled={busy}
              onClick={() =>
                window.confirm(
                  'Reset the link? Calendars subscribed to the old link will stop updating until you give them the new one.',
                ) && saveToken(randomToken())
              }
            >
              Reset link
            </button>
            <button
              type="button"
              className="link-button danger-link"
              disabled={busy}
              onClick={() =>
                window.confirm('Turn the feed off? Subscribed calendars will stop updating.') &&
                saveToken('')
              }
            >
              Turn off
            </button>
          </div>
        </>
      )}

      {error && <p className="invite-error">{error}</p>}
    </section>
  )
}
