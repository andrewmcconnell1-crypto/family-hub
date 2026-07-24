import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import EventSheet from './EventSheet.jsx'
import PlanDayCard from './PlanDayCard.jsx'
import { calendarOccurrences, weekdayIndex } from '../utils/recurrence.js'
import { addDays, formatDateKey, todayKey } from '../utils/dateUtils.js'

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
        <PlanDayCard
          key={day.key}
          day={day}
          people={data.children}
          isToday={day.key === today}
          lockSynthetic
          onOpenEvent={openOccurrence}
          onAddPlan={({ text, childIds }) => addPlanItem({ date: day.key, text, childIds })}
          onRemovePlan={removePlanItem}
        />
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
