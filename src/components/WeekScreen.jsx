import { useMemo, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Paperclip, Plus, Repeat } from 'lucide-react'
import EventSheet from './EventSheet.jsx'
import { ChildTags } from './ChildChips.jsx'
import { calendarColor } from '../lib/familyData.js'
import { calendarOccurrences, weekdayIndex } from '../utils/recurrence.js'
import { addDays, dayParts, formatDateKey, todayKey } from '../utils/dateUtils.js'

const mondayOf = (key) => addDays(key, -weekdayIndex(key))

// Timed events sort before all-day within a day; external feeds sort with them.
const byTime = (a, b) => (a.time || '99:99').localeCompare(b.time || '99:99')

// The whole week at a glance, Bistro Plan-style: one section per day with the
// day's events (recurrences and birthdays included) AND the to-dos due that
// day, tick-off-able in place.
export default function WeekScreen({
  tabs,
  data,
  addEvent,
  updateEvent,
  removeEvent,
  skipEventOccurrence,
  toggleTodo,
  externalOccurrences,
}) {
  const today = todayKey()
  const [weekStart, setWeekStart] = useState(() => mondayOf(today))
  const weekEnd = addDays(weekStart, 6)
  const [sheet, setSheet] = useState(null) // null | { event?, occurrenceDate?, defaultDate? }

  const days = useMemo(() => {
    const eventsByDay = new Map()
    const push = (occurrence) => {
      if (!eventsByDay.has(occurrence.date)) eventsByDay.set(occurrence.date, [])
      eventsByDay.get(occurrence.date).push(occurrence)
    }
    for (const occurrence of calendarOccurrences(data, weekStart, weekEnd)) push(occurrence)
    if (externalOccurrences) for (const occurrence of externalOccurrences(weekStart, weekEnd)) push(occurrence)
    for (const list of eventsByDay.values()) list.sort(byTime)
    return Array.from({ length: 7 }, (_, i) => {
      const key = addDays(weekStart, i)
      return {
        key,
        events: eventsByDay.get(key) || [],
        todos: data.todos.filter((todo) => !todo.done && todo.dueDate === key),
      }
    })
  }, [data, weekStart, weekEnd, externalOccurrences])

  const isCurrentWeek = weekStart === mondayOf(today)

  const openOccurrence = (occurrence) => {
    if (occurrence.isBirthday || occurrence.isExternal) return
    const series = data.events.find((e) => e.id === occurrence.id)
    if (series) setSheet({ event: series, occurrenceDate: occurrence.date })
  }

  return (
    <div className="screen">
      <header className="screen-header screen-header-row planner-header">
        {tabs || <h1>Week</h1>}
        <button type="button" className="primary-button" onClick={() => setSheet({ defaultDate: isCurrentWeek ? today : weekStart })}>
          <Plus size={18} aria-hidden="true" /> Event
        </button>
      </header>

      <div className="week-nav card">
        <button
          type="button"
          className="icon-button"
          aria-label="Previous week"
          onClick={() => setWeekStart((k) => addDays(k, -7))}
        >
          <ChevronLeft size={20} />
        </button>
        <span className="week-nav-label">
          <strong>
            {formatDateKey(weekStart)} – {formatDateKey(weekEnd)}
          </strong>
          {!isCurrentWeek && (
            <button type="button" className="link-button" onClick={() => setWeekStart(mondayOf(today))}>
              This week
            </button>
          )}
        </span>
        <button
          type="button"
          className="icon-button"
          aria-label="Next week"
          onClick={() => setWeekStart((k) => addDays(k, 7))}
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {days.map((day) => (
        <section key={day.key} className={`card week-day${day.key === today ? ' week-day-today' : ''}`}>
          <div className="card-title-row">
            <h2 className="week-day-title">
              <span className="date-leaf" aria-hidden="true">
                <span className="date-leaf-dow">{dayParts(day.key).dow}</span>
                <span className="date-leaf-num">{dayParts(day.key).num}</span>
              </span>
              {dayParts(day.key).weekdayLong}
              {day.key === today && <span className="today-chip">Today</span>}
            </h2>
            <button
              type="button"
              className="icon-button"
              aria-label={`Add event on ${formatDateKey(day.key, { weekday: true })}`}
              onClick={() => setSheet({ defaultDate: day.key })}
            >
              <Plus size={18} />
            </button>
          </div>

          {day.events.length === 0 && day.todos.length === 0 ? (
            <p className="muted week-empty">Nothing on</p>
          ) : (
            <>
              {day.events.length > 0 && (
                <ul className="event-list">
                  {day.events.map((occurrence) => (
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
                            {occurrence.repeat !== 'none' && !occurrence.isBirthday && (
                              <Repeat size={12} aria-label="Repeats" />
                            )}
                            {occurrence.documentIds?.length > 0 && (
                              <Paperclip size={12} aria-label="Has attachments" />
                            )}
                            {occurrence.isExternal ? (
                              <span className="external-tag">{occurrence.calendarName}</span>
                            ) : (
                              <ChildTags kids={data.children} childIds={occurrence.childIds} />
                            )}
                          </span>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {day.todos.length > 0 && (
                <ul className="todo-list week-todos">
                  {day.todos.map((todo) => (
                    <li key={todo.id} className="todo-row">
                      <button
                        type="button"
                        className="todo-check"
                        role="checkbox"
                        aria-checked={false}
                        aria-label={`Mark “${todo.title}” done`}
                        onClick={() => toggleTodo(todo.id)}
                      >
                        <Check size={14} aria-hidden="true" style={{ visibility: 'hidden' }} />
                      </button>
                      <span className="todo-main">
                        <span className="todo-title">{todo.title}</span>
                        <span className="todo-meta">
                          <span className="muted">to-do</span>
                          <ChildTags kids={data.children} childIds={todo.childIds} />
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>
      ))}

      {sheet && (
        <EventSheet
          kids={data.children}
          documents={data.documents}
          event={sheet.event}
          occurrenceDate={sheet.occurrenceDate}
          defaultDate={sheet.defaultDate || today}
          onSave={(fields) => {
            if (sheet.event) updateEvent(sheet.event.id, fields)
            else addEvent(fields)
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
