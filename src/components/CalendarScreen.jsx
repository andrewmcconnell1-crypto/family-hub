import { useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import Sheet from './Sheet.jsx'
import EmptyState from './EmptyState.jsx'
import { ChildMultiSelect, ChildTags } from './ChildChips.jsx'
import { EVENT_CATEGORIES, childColor } from '../lib/familyData.js'
import {
  addMonths,
  formatDateKey,
  monthGrid,
  monthLabel,
  parseDateKey,
  startOfMonth,
  todayKey,
} from '../utils/dateUtils.js'

export default function CalendarScreen({ data, addEvent, updateEvent, removeEvent }) {
  const today = todayKey()
  const [selectedKey, setSelectedKey] = useState(today)
  const [monthDate, setMonthDate] = useState(() => startOfMonth(parseDateKey(today)))
  const [sheet, setSheet] = useState(null) // null | { event? }

  const weeks = useMemo(() => monthGrid(monthDate), [monthDate])
  const eventsByDate = useMemo(() => {
    const map = new Map()
    for (const event of data.events) {
      if (!map.has(event.date)) map.set(event.date, [])
      map.get(event.date).push(event)
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'))
    }
    return map
  }, [data.events])

  const dayEvents = eventsByDate.get(selectedKey) || []

  return (
    <div className="screen">
      <header className="screen-header screen-header-row">
        <h1>Calendar</h1>
        <button type="button" className="primary-button" onClick={() => setSheet({})}>
          <Plus size={18} aria-hidden="true" /> Event
        </button>
      </header>

      <div className="card calendar-card">
        <div className="month-nav">
          <button
            type="button"
            className="icon-button"
            aria-label="Previous month"
            onClick={() => setMonthDate((m) => addMonths(m, -1))}
          >
            <ChevronLeft size={20} />
          </button>
          <strong>{monthLabel(monthDate)}</strong>
          <button
            type="button"
            className="icon-button"
            aria-label="Next month"
            onClick={() => setMonthDate((m) => addMonths(m, 1))}
          >
            <ChevronRight size={20} />
          </button>
        </div>
        <div className="month-grid" role="grid">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
            <span key={i} className="dow">
              {d}
            </span>
          ))}
          {weeks.flat().map((cell) => {
            const cellEvents = eventsByDate.get(cell.key) || []
            return (
              <button
                key={cell.key}
                type="button"
                className={[
                  'day-cell',
                  cell.inMonth ? '' : 'day-out',
                  cell.key === today ? 'day-today' : '',
                  cell.key === selectedKey ? 'day-selected' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => setSelectedKey(cell.key)}
              >
                <span>{cell.dayNumber}</span>
                {cellEvents.length > 0 && (
                  <span className="day-dots">
                    {cellEvents.slice(0, 3).map((event) => (
                      <span
                        key={event.id}
                        className="day-dot"
                        style={{ background: dotColor(event, data.children) }}
                      />
                    ))}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <section className="card">
        <h2>{formatDateKey(selectedKey, { weekday: true })}</h2>
        {dayEvents.length === 0 ? (
          <EmptyState icon={CalendarDays} title="Nothing planned" hint="Tap “Event” to add something for this day." />
        ) : (
          <ul className="event-list">
            {dayEvents.map((event) => (
              <li key={event.id}>
                <button type="button" className="event-row event-row-button" onClick={() => setSheet({ event })}>
                  <div className="event-when">
                    {event.time ? <span className="event-time">{event.time}</span> : <span className="event-time muted">all day</span>}
                  </div>
                  <div className="event-main">
                    <span className="event-title">{event.title}</span>
                    <span className="event-meta">
                      {EVENT_CATEGORIES.find((c) => c.id === event.category)?.label}
                      <ChildTags kids={data.children} childIds={event.childIds} />
                    </span>
                    {event.notes && <span className="event-notes">{event.notes}</span>}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {sheet && (
        <EventSheet
          kids={data.children}
          event={sheet.event}
          defaultDate={selectedKey}
          onSave={(fields) => {
            if (sheet.event) updateEvent(sheet.event.id, fields)
            else addEvent(fields)
            setSelectedKey(fields.date)
            setMonthDate(startOfMonth(parseDateKey(fields.date)))
            setSheet(null)
          }}
          onDelete={
            sheet.event
              ? () => {
                  removeEvent(sheet.event.id)
                  setSheet(null)
                }
              : null
          }
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  )
}

function dotColor(event, kids) {
  const child = kids.find((c) => event.childIds.includes(c.id))
  return child ? childColor(child) : 'var(--accent)'
}

function EventSheet({ kids, event, defaultDate, onSave, onDelete, onClose }) {
  const [title, setTitle] = useState(event?.title || '')
  const [date, setDate] = useState(event?.date || defaultDate)
  const [time, setTime] = useState(event?.time || '')
  const [category, setCategory] = useState(event?.category || 'other')
  const [childIds, setChildIds] = useState(event?.childIds || [])
  const [notes, setNotes] = useState(event?.notes || '')

  const submit = (e) => {
    e.preventDefault()
    if (!title.trim() || !date) return
    onSave({ title: title.trim(), date, time, category, childIds, notes: notes.trim() })
  }

  return (
    <Sheet title={event ? 'Edit event' : 'New event'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label>
          Title
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Swimming lesson" autoFocus required />
        </label>
        <div className="form-row">
          <label>
            Date
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </label>
          <label>
            Time <span className="muted">(optional)</span>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </label>
        </div>
        <label>
          Category
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {EVENT_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        {kids.length > 0 && (
          <div className="form-field">
            <span className="form-label">Who's it for? <span className="muted">(none = whole family)</span></span>
            <ChildMultiSelect kids={kids} value={childIds} onChange={setChildIds} />
          </div>
        )}
        <label>
          Notes
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Bring goggles" />
        </label>
        <div className="form-actions">
          {onDelete && (
            <button type="button" className="danger-button" onClick={onDelete}>
              Delete
            </button>
          )}
          <button type="submit" className="primary-button">
            Save
          </button>
        </div>
      </form>
    </Sheet>
  )
}
