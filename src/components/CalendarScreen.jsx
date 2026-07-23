import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import EventSheet from './EventSheet.jsx'
import { calendarColor, childColor } from '../lib/familyData.js'
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
  focus,
}) {
  const today = todayKey()
  // A deep-link from Home mounts this screen fresh with `focus` set, so we seed
  // the month and open sheet straight from it (no effect / cascading render).
  // App clears the focus on any other navigation.
  const [monthDate, setMonthDate] = useState(() =>
    startOfMonth(parseDateKey(focus?.date || today)),
  )
  const [sheet, setSheet] = useState(() => {
    if (focus?.kind === 'event') {
      const series = data.events.find((e) => e.id === focus.id)
      if (series) return { event: series, occurrenceDate: focus.date }
    }
    return null
  }) // null | { event?, occurrenceDate? }

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

  const openOccurrence = (occurrence) => {
    if (occurrence.isBirthday || occurrence.isExternal) return
    const series = data.events.find((e) => e.id === occurrence.id)
    if (series) setSheet({ event: series, occurrenceDate: occurrence.date })
  }

  return (
    <div className="screen">
      <header className="screen-header screen-header-row planner-header">
        {tabs || <h1>Calendar</h1>}
        <button type="button" className="primary-button" onClick={() => setSheet({ date: today })}>
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
              <div
                key={cell.key}
                className={[
                  'day-cell',
                  cell.inMonth ? '' : 'day-out',
                  cell.key === today ? 'day-today' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <button
                  type="button"
                  className="day-num"
                  aria-label={`Add event on ${formatDateKey(cell.key, { weekday: true })}`}
                  onClick={() => setSheet({ date: cell.key })}
                >
                  {cell.dayNumber}
                </button>
                <div className="day-events">
                  {cellEvents.slice(0, 3).map((event, i) => (
                    <button
                      key={`${event.id}-${i}`}
                      type="button"
                      className="day-event"
                      style={{ '--evt': dotColor(event, data.children) }}
                      disabled={event.isBirthday || event.isExternal}
                      onClick={() => openOccurrence(event)}
                      title={event.title}
                    >
                      {event.title}
                    </button>
                  ))}
                  {cellEvents.length > 3 && (
                    <span className="day-more">+{cellEvents.length - 3}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {sheet && (
        <EventSheet
          kids={data.children}
          documents={data.documents}
          event={sheet.event}
          occurrenceDate={sheet.occurrenceDate}
          defaultDate={sheet.date || today}
          onSave={(fields) => {
            if (sheet.event) updateEvent(sheet.event.id, fields)
            else addEvent(fields)
            if (fields.repeat === 'none') {
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
