import { useMemo, useState } from 'react'
import { Bell, CalendarDays, ChevronLeft, ChevronRight, Paperclip, Plus, Repeat } from 'lucide-react'
import EmptyState from './EmptyState.jsx'
import EventSheet from './EventSheet.jsx'
import { ChildTags } from './ChildChips.jsx'
import { EVENT_CATEGORIES, calendarColor, childColor } from '../lib/familyData.js'
import { calendarOccurrences } from '../utils/recurrence.js'
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
  externalOccurrences,
}) {
  const today = todayKey()
  const [selectedKey, setSelectedKey] = useState(today)
  const [monthDate, setMonthDate] = useState(() => startOfMonth(parseDateKey(today)))
  const [sheet, setSheet] = useState(null) // null | { event?, occurrenceDate? }

  const weeks = useMemo(() => monthGrid(monthDate), [monthDate])

  // Everything visible in the grid: events expanded into occurrences (weekly /
  // fortnightly / monthly / yearly), birthdays from members' DOBs, and any
  // subscribed external calendars (read-only).
  const eventsByDate = useMemo(() => {
    const gridStart = weeks[0][0].key
    const gridEnd = weeks[weeks.length - 1][6].key
    const map = new Map()
    const push = (occurrence) => {
      if (!map.has(occurrence.date)) map.set(occurrence.date, [])
      map.get(occurrence.date).push(occurrence)
    }
    for (const occurrence of calendarOccurrences(data, gridStart, gridEnd)) push(occurrence)
    if (externalOccurrences) for (const occurrence of externalOccurrences(gridStart, gridEnd)) push(occurrence)
    for (const list of map.values()) {
      list.sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'))
    }
    return map
  }, [data, weeks, externalOccurrences])

  const dayEvents = eventsByDate.get(selectedKey) || []

  const openOccurrence = (occurrence) => {
    if (occurrence.isBirthday || occurrence.isExternal) return
    const series = data.events.find((e) => e.id === occurrence.id)
    if (series) setSheet({ event: series, occurrenceDate: occurrence.date })
  }

  return (
    <div className="screen">
      <header className="screen-header screen-header-row planner-header">
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
                  className={`event-row event-row-button${occurrence.isExternal ? ' event-row-external' : ''}`}
                  style={
                    occurrence.isExternal
                      ? { borderLeftColor: calendarColor({ colorId: occurrence.calendarColorId }) }
                      : undefined
                  }
                  disabled={occurrence.isBirthday || occurrence.isExternal}
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
                      {occurrence.isExternal
                        ? occurrence.calendarName
                        : EVENT_CATEGORIES.find((c) => c.id === occurrence.category)?.label}
                      {occurrence.repeat !== 'none' && !occurrence.isBirthday && (
                        <Repeat size={12} aria-label="Repeats" />
                      )}
                      {occurrence.documentIds?.length > 0 && (
                        <Paperclip size={12} aria-label="Has attachments" />
                      )}
                      {Number.isInteger(occurrence.reminder) && (
                        <Bell size={12} aria-label="Reminder set" />
                      )}
                      {!occurrence.isExternal && (
                        <ChildTags kids={data.children} childIds={occurrence.childIds} />
                      )}
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
          documents={data.documents}
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
  if (event.isExternal) return calendarColor({ colorId: event.calendarColorId })
  const child = kids.find((c) => event.childIds.includes(c.id))
  return child ? childColor(child) : 'var(--accent)'
}
