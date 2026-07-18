import { useState } from 'react'
import { CalendarClock, Check, Plus, RefreshCw, X } from 'lucide-react'
import { CALENDAR_COLORS, calendarColor } from '../lib/familyData.js'
import { calendarErrorMessage } from '../lib/externalCalendars.js'

// Settings card: subscribe to external calendars (Google/Outlook/iCloud) by
// their secret iCal URL. Their events then appear read-only across the app.
// Adding/removing goes through the store (so it syncs to the household);
// fetching/caching is the useExternalCalendars hook passed in as `feed`.
export default function ExternalCalendarsCard({
  calendars,
  feed,
  addExternalCalendar,
  removeExternalCalendar,
  signedIn,
}) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [colorId, setColorId] = useState('grape')

  const list = calendars || []

  const reset = () => {
    setName('')
    setUrl('')
    setColorId('grape')
    setAdding(false)
  }

  const submit = (e) => {
    e.preventDefault()
    const trimmedUrl = url.trim()
    if (!trimmedUrl) return
    addExternalCalendar({
      name: name.trim() || 'Calendar',
      url: trimmedUrl,
      colorId,
    })
    reset()
  }

  return (
    <section className="card">
      <h2>Other calendars</h2>
      <p className="muted">
        See a Google, Outlook or Apple calendar inside Treehouse. Copy its private iCal / .ics
        address and paste it here — those events show up read-only across your week and calendar.
      </p>

      {!signedIn && (
        <p className="muted">
          Sign in first — external calendars are fetched through your account so they don't get
          blocked.
        </p>
      )}

      {list.length > 0 && (
        <ul className="ext-cal-list">
          {list.map((cal) => {
            const status = feed?.status(cal.id) || 'loading'
            const error = feed?.feeds.get(cal.id)?.error
            return (
              <li key={cal.id} className="ext-cal-row">
                <span
                  className="ext-cal-swatch"
                  style={{ background: calendarColor(cal) }}
                  aria-hidden="true"
                />
                <span className="ext-cal-main">
                  <span className="ext-cal-name">{cal.name}</span>
                  <span className="ext-cal-status">
                    {status === 'ok' && (
                      <>
                        <Check size={12} aria-hidden="true" /> Synced
                      </>
                    )}
                    {status === 'loading' && 'Updating…'}
                    {status === 'error' && (
                      <span className="ext-cal-error">{calendarErrorMessage(error)}</span>
                    )}
                  </span>
                </span>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Refresh ${cal.name}`}
                  onClick={() => feed?.refresh(cal.id)}
                >
                  <RefreshCw size={16} />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Remove ${cal.name}`}
                  onClick={() =>
                    window.confirm(`Stop showing “${cal.name}”?`) && removeExternalCalendar(cal.id)
                  }
                >
                  <X size={18} />
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {adding ? (
        <form className="form ext-cal-form" onSubmit={submit}>
          <label>
            Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Dom's work calendar"
              autoFocus
            />
          </label>
          <label>
            Calendar address (iCal / .ics URL)
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://calendar.google.com/…/basic.ics"
              inputMode="url"
              required
            />
          </label>
          <div className="form-field">
            <span className="form-label">Colour</span>
            <div className="chip-row">
              {CALENDAR_COLORS.map((color) => (
                <button
                  key={color.id}
                  type="button"
                  className={`swatch${colorId === color.id ? ' swatch-active' : ''}`}
                  style={{ background: color.value }}
                  aria-label={color.id}
                  aria-pressed={colorId === color.id}
                  onClick={() => setColorId(color.id)}
                />
              ))}
            </div>
          </div>
          <div className="form-actions">
            <button type="button" className="link-button" onClick={reset}>
              Cancel
            </button>
            <button type="submit" className="primary-button">
              Add calendar
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          className="primary-button"
          disabled={!signedIn}
          onClick={() => setAdding(true)}
        >
          <Plus size={16} aria-hidden="true" /> Add a calendar
        </button>
      )}

      <details className="ext-cal-help">
        <summary>
          <CalendarClock size={14} aria-hidden="true" /> Where do I find the address?
        </summary>
        <ul>
          <li>
            <strong>Google Calendar</strong> (computer): Settings → click the calendar → Integrate
            calendar → <em>Secret address in iCal format</em>.
          </li>
          <li>
            <strong>Outlook / Microsoft 365</strong>: Settings → Calendar → Shared calendars →
            Publish a calendar → publish, then copy the <em>ICS</em> link.
          </li>
          <li>
            <strong>Apple iCloud</strong>: on iCloud.com share the calendar as a{' '}
            <em>Public Calendar</em> and copy the <code>webcal://</code> link.
          </li>
        </ul>
        <p className="muted">Treat these links like passwords — anyone with one can read that calendar.</p>
      </details>
    </section>
  )
}
