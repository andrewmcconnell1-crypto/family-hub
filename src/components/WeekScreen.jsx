import { useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Plus, X } from 'lucide-react'
import EventSheet from './EventSheet.jsx'
import { ChildTags } from './ChildChips.jsx'
import { childColor } from '../lib/familyData.js'
import { calendarOccurrences, weekdayIndex } from '../utils/recurrence.js'
import { addDays, dayParts, formatDateKey, todayKey } from '../utils/dateUtils.js'

const mondayOf = (key) => addDays(key, -weekdayIndex(key))
const byTime = (a, b) => (a.time || '99:99').localeCompare(b.time || '99:99')

// "Map out my week": a quick, disposable planning board. Under each day you jot
// short plan notes (who's got the girls, running days, office days), optionally
// tagged to a person. That week's calendar events (birthdays, appointments)
// show alongside as light context — the long-term stuff still lives in the
// Calendar. "Copy last week" pulls the previous week's plan in to tweak.
export default function WeekScreen({
  tabs,
  data,
  addEvent,
  updateEvent,
  removeEvent,
  skipEventOccurrence,
  addPlanItem,
  removePlanItem,
  copyWeekPlan,
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
        plans: (data.weekPlans || []).filter((p) => p.date === key),
      }
    })
  }, [data, weekStart, weekEnd, externalOccurrences])

  const isCurrentWeek = weekStart === mondayOf(today)
  const weekPlanCount = days.reduce((n, d) => n + d.plans.length, 0)
  const prevWeekStart = addDays(weekStart, -7)
  const lastWeekHasPlan = useMemo(
    () => (data.weekPlans || []).some((p) => p.date >= prevWeekStart && p.date < weekStart),
    [data.weekPlans, prevWeekStart, weekStart],
  )

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

      {weekPlanCount === 0 && lastWeekHasPlan && (
        <button
          type="button"
          className="card card-cta copy-week-cta"
          onClick={() => copyWeekPlan(prevWeekStart, weekStart)}
        >
          <strong>Copy last week</strong>
          <span>Pull in last week's plan and tweak what's different.</span>
        </button>
      )}

      {days.map((day) => (
        <section key={day.key} className={`card plan-day${day.key === today ? ' week-day-today' : ''}`}>
          <div className="plan-day-head">
            <span className="date-leaf" aria-hidden="true">
              <span className="date-leaf-dow">{dayParts(day.key).dow}</span>
              <span className="date-leaf-num">{dayParts(day.key).num}</span>
            </span>
            <h2 className="plan-day-title">
              {dayParts(day.key).weekdayLong}
              {day.key === today && <span className="today-chip">Today</span>}
            </h2>
          </div>

          {day.events.length > 0 && (
            <ul className="plan-events">
              {day.events.map((occurrence) => (
                <li key={`${occurrence.id}-${occurrence.date}`}>
                  <button
                    type="button"
                    className="plan-event"
                    disabled={occurrence.isBirthday || occurrence.isExternal}
                    onClick={() => openOccurrence(occurrence)}
                  >
                    <CalendarDays size={13} aria-hidden="true" className="plan-event-icon" />
                    {occurrence.time && <span className="plan-event-time">{occurrence.time}</span>}
                    <span className="plan-event-title">{occurrence.title}</span>
                    {occurrence.isExternal && (
                      <span className="external-tag">{occurrence.calendarName}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {day.plans.length > 0 && (
            <ul className="plan-items">
              {day.plans.map((plan) => {
                const person = data.children.find((c) => plan.childIds?.includes(c.id))
                return (
                  <li
                    key={plan.id}
                    className="plan-item"
                    style={person ? { borderLeftColor: childColor(person) } : undefined}
                  >
                    <span className="plan-item-text">{plan.text}</span>
                    <ChildTags kids={data.children} childIds={plan.childIds} />
                    <button
                      type="button"
                      className="plan-item-remove"
                      aria-label={`Remove “${plan.text}”`}
                      onClick={() => removePlanItem(plan.id)}
                    >
                      <X size={15} />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          <PlanAdder
            people={data.children}
            onAdd={({ text, childIds }) => addPlanItem({ date: day.key, text, childIds })}
          />
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

// Inline quick-add for a day's plan. Stays open after adding so you can rattle
// off several notes; the person chips remember your last pick for speed.
function PlanAdder({ people, onAdd }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [childIds, setChildIds] = useState([])

  const toggle = (id) =>
    setChildIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))

  const submit = (e) => {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed) return
    onAdd({ text: trimmed, childIds })
    setText('')
  }

  if (!open) {
    return (
      <button type="button" className="plan-add-btn" onClick={() => setOpen(true)}>
        <Plus size={15} aria-hidden="true" /> Add
      </button>
    )
  }

  return (
    <form className="plan-add-form" onSubmit={submit}>
      <input
        className="plan-add-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="e.g. Dom running early"
        autoFocus
      />
      {people.length > 0 && (
        <div className="plan-who">
          {people.map((person) => {
            const on = childIds.includes(person.id)
            const color = childColor(person)
            return (
              <button
                type="button"
                key={person.id}
                className={`plan-who-chip${on ? ' is-on' : ''}`}
                style={
                  on
                    ? { background: color, borderColor: color, color: '#fff' }
                    : { borderColor: color, color }
                }
                onClick={() => toggle(person.id)}
              >
                {person.name}
              </button>
            )
          })}
        </div>
      )}
      <div className="plan-add-actions">
        <button
          type="button"
          className="link-button"
          onClick={() => {
            setOpen(false)
            setText('')
          }}
        >
          Done
        </button>
        <button type="submit" className="secondary-button plan-add-save" disabled={!text.trim()}>
          Add
        </button>
      </div>
    </form>
  )
}
