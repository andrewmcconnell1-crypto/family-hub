import { useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Repeat } from 'lucide-react'
import Sheet from './Sheet.jsx'
import EmptyState from './EmptyState.jsx'
import { ChildMultiSelect, ChildTags } from './ChildChips.jsx'
import { EVENT_CATEGORIES, childColor } from '../lib/familyData.js'
import {
  REPEAT_OPTIONS,
  WEEKDAY_LABELS,
  calendarOccurrences,
  weekdayIndex,
} from '../utils/recurrence.js'
import {
  addMonths,
  formatDateKey,
  monthGrid,
  monthLabel,
  parseDateKey,
  startOfMonth,
  todayKey,
} from '../utils/dateUtils.js'

export default function CalendarScreen({
  tabs,
  data,
  addEvent,
  updateEvent,
  removeEvent,
  skipEventOccurrence,
}) {
  const today = todayKey()
  const [selectedKey, setSelectedKey] = useState(today)
  const [monthDate, setMonthDate] = useState(() => startOfMonth(parseDateKey(today)))
  const [sheet, setSheet] = useState(null) // null | { event?, occurrenceDate? }

  const weeks = useMemo(() => monthGrid(monthDate), [monthDate])

  // Everything visible in the grid: events expanded into occurrences (weekly /
  // fortnightly / monthly / yearly) plus birthdays from members' DOBs.
  const eventsByDate = useMemo(() => {
    const gridStart = weeks[0][0].key
    const gridEnd = weeks[weeks.length - 1][6].key
    const map = new Map()
    for (const occurrence of calendarOccurrences(data, gridStart, gridEnd)) {
      if (!map.has(occurrence.date)) map.set(occurrence.date, [])
      map.get(occurrence.date).push(occurrence)
    }
    return map
  }, [data, weeks])

  const dayEvents = eventsByDate.get(selectedKey) || []

  const openOccurrence = (occurrence) => {
    if (occurrence.isBirthday) return
    const series = data.events.find((e) => e.id === occurrence.id)
    if (series) setSheet({ event: series, occurrenceDate: occurrence.date })
  }

  return (
    <div className="screen">
      <header className="screen-header screen-header-row">
        {tabs || <h1>Calendar</h1>}
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
                    {cellEvents.slice(0, 3).map((event, i) => (
                      <span
                        key={`${event.id}-${i}`}
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
            {dayEvents.map((occurrence) => (
              <li key={`${occurrence.id}-${occurrence.date}`}>
                <button
                  type="button"
                  className="event-row event-row-button"
                  disabled={occurrence.isBirthday}
                  onClick={() => openOccurrence(occurrence)}
                >
                  <div className="event-when">
                    {occurrence.time ? (
                      <span className="event-time">{occurrence.time}</span>
                    ) : (
                      <span className="event-time muted">all day</span>
                    )}
                  </div>
                  <div className="event-main">
                    <span className="event-title">{occurrence.title}</span>
                    <span className="event-meta">
                      {EVENT_CATEGORIES.find((c) => c.id === occurrence.category)?.label}
                      {occurrence.repeat !== 'none' && !occurrence.isBirthday && (
                        <Repeat size={12} aria-label="Repeats" />
                      )}
                      <ChildTags kids={data.children} childIds={occurrence.childIds} />
                    </span>
                    {occurrence.notes && <span className="event-notes">{occurrence.notes}</span>}
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
          occurrenceDate={sheet.occurrenceDate}
          defaultDate={selectedKey}
          onSave={(fields) => {
            if (sheet.event) updateEvent(sheet.event.id, fields)
            else addEvent(fields)
            if (fields.repeat === 'none') {
              setSelectedKey(fields.date)
              setMonthDate(startOfMonth(parseDateKey(fields.date)))
            }
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
          onSkipDay={
            sheet.event && sheet.event.repeat !== 'none' && sheet.occurrenceDate
              ? () => {
                  skipEventOccurrence(sheet.event.id, sheet.occurrenceDate)
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

function EventSheet({ kids, event, occurrenceDate, defaultDate, onSave, onDelete, onSkipDay, onClose }) {
  const [title, setTitle] = useState(event?.title || '')
  const [date, setDate] = useState(event?.date || defaultDate)
  const [time, setTime] = useState(event?.time || '')
  const [category, setCategory] = useState(event?.category || 'other')
  const [childIds, setChildIds] = useState(event?.childIds || [])
  const [notes, setNotes] = useState(event?.notes || '')
  const [repeat, setRepeat] = useState(event?.repeat || 'none')
  const [weekdays, setWeekdays] = useState(event?.weekdays || [])
  const [endDate, setEndDate] = useState(event?.endDate || '')

  const pickDays = repeat === 'weekly' || repeat === 'fortnightly'

  const changeRepeat = (next) => {
    setRepeat(next)
    if ((next === 'weekly' || next === 'fortnightly') && weekdays.length === 0 && date) {
      setWeekdays([weekdayIndex(date)])
    }
  }

  const toggleWeekday = (dayIndex) =>
    setWeekdays((days) =>
      days.includes(dayIndex) ? days.filter((d) => d !== dayIndex) : [...days, dayIndex].sort(),
    )

  const submit = (e) => {
    e.preventDefault()
    if (!title.trim() || !date) return
    onSave({
      title: title.trim(),
      date,
      time,
      category,
      childIds,
      notes: notes.trim(),
      repeat,
      weekdays: pickDays ? weekdays : [],
      endDate: repeat === 'none' ? '' : endDate,
    })
  }

  return (
    <Sheet title={event ? 'Edit event' : 'New event'} onClose={onClose}>
      {event && event.repeat !== 'none' && (
        <p className="muted series-note">
          Repeating event — changes apply to the whole series
          {occurrenceDate ? ` (opened from ${formatDateKey(occurrenceDate, { weekday: true })})` : ''}.
        </p>
      )}
      <form className="form" onSubmit={submit}>
        <label>
          Title
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Swimming lesson" autoFocus required />
        </label>
        <div className="form-row">
          <label>
            {repeat === 'none' ? 'Date' : 'Starts'}
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </label>
          <label>
            Time <span className="muted">(optional)</span>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </label>
        </div>
        <div className="form-row">
          <label>
            Repeat
            <select value={repeat} onChange={(e) => changeRepeat(e.target.value)}>
              {REPEAT_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
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
        </div>
        {pickDays && (
          <div className="form-field">
            <span className="form-label">On days</span>
            <div className="chip-row">
              {WEEKDAY_LABELS.map((label, dayIndex) => (
                <button
                  key={label}
                  type="button"
                  className={`chip${weekdays.includes(dayIndex) ? ' chip-active' : ''}`}
                  aria-pressed={weekdays.includes(dayIndex)}
                  onClick={() => toggleWeekday(dayIndex)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
        {repeat !== 'none' && (
          <label>
            Repeats until <span className="muted">(optional)</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </label>
        )}
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
          {onSkipDay && (
            <button type="button" className="danger-button" onClick={onSkipDay}>
              Delete this day
            </button>
          )}
          {onDelete && (
            <button type="button" className="danger-button" onClick={onDelete}>
              {event?.repeat !== 'none' ? 'Delete series' : 'Delete'}
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
