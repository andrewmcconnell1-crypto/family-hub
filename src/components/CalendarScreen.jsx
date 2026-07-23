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

// How many event lanes fit in a week row before the rest collapse to a "+N".
const MAX_LANES = 4

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
  // A deep-link from Home mounts this fresh with `focus` set; seed the day,
  // month and open sheet from it. App clears focus on any other navigation.
  const [selectedKey, setSelectedKey] = useState(focus?.date || today)
  const [monthDate, setMonthDate] = useState(() => startOfMonth(parseDateKey(focus?.date || today)))
  const [sheet, setSheet] = useState(() => {
    if (focus?.kind === 'event') {
      const series = data.events.find((e) => e.id === focus.id)
      if (series) return { event: series, occurrenceDate: focus.date }
    }
    return null
  })

  const weeks = useMemo(() => monthGrid(monthDate), [monthDate])

  // Occurrences (recurring expanded, birthdays, externals) grouped by day. A
  // multi-day event appears once per day it covers (each with spanStart/End).
  const eventsByDate = useMemo(() => {
    const gridStart = weeks[0][0].key
    const gridEnd = weeks[weeks.length - 1][6].key
    const map = new Map()
    const push = (o) => {
      if (!map.has(o.date)) map.set(o.date, [])
      map.get(o.date).push(o)
    }
    for (const o of calendarOccurrences(data, gridStart, gridEnd)) push(o)
    if (externalOccurrences) for (const o of externalOccurrences(gridStart, gridEnd)) push(o)
    for (const list of map.values()) list.sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'))
    return map
  }, [data, weeks, externalOccurrences])

  const dayColor = (event) => {
    if (event.isExternal) return calendarColor({ colorId: event.calendarColorId })
    const child = data.children.find((c) => event.childIds?.includes(c.id))
    return child ? childColor(child) : 'var(--accent)'
  }

  // Turn each week into positioned event bars: a multi-day event becomes a
  // single bar spanning its columns; overlapping bars are stacked into lanes.
  const weekViews = useMemo(
    () =>
      weeks.map((week) => {
        const startKey = week[0].key
        const endKey = week[6].key
        // Merge each event's days within this week into one column range.
        const seen = new Map()
        for (let ci = 0; ci < 7; ci++) {
          for (const occ of eventsByDate.get(week[ci].key) || []) {
            const uid = `${occ.id}:${occ.seriesDate || occ.date}:${occ.spanStart || occ.date}`
            const seg = seen.get(uid)
            if (seg) seg.colEnd = ci
            else seen.set(uid, { occ, colStart: ci, colEnd: ci })
          }
        }
        const segments = [...seen.values()]
          .map((s) => ({
            occ: s.occ,
            colStart: s.colStart,
            colSpan: s.colEnd - s.colStart + 1,
            continuesLeft: Boolean(s.occ.spanStart) && s.occ.spanStart < startKey,
            continuesRight: Boolean(s.occ.spanEnd) && s.occ.spanEnd > endKey,
          }))
          .sort(
            (a, b) =>
              a.colStart - b.colStart ||
              b.colSpan - a.colSpan ||
              (a.occ.time || '99:99').localeCompare(b.occ.time || '99:99'),
          )
        // Greedy lane assignment: first lane with no column overlap.
        const lanes = []
        for (const seg of segments) {
          let li = 0
          for (;;) {
            const lane = lanes[li] || (lanes[li] = [])
            const clash = lane.some(
              (s) => !(seg.colStart + seg.colSpan <= s.colStart || s.colStart + s.colSpan <= seg.colStart),
            )
            if (!clash) {
              seg.lane = li
              lane.push(seg)
              break
            }
            li++
          }
        }
        // Anything past MAX_LANES becomes a per-day "+N" badge.
        const overflow = new Array(7).fill(0)
        const shown = segments.filter((s) => {
          if (s.lane < MAX_LANES) return true
          for (let c = s.colStart; c < s.colStart + s.colSpan; c++) overflow[c]++
          return false
        })
        return { week, segments: shown, overflow, laneCount: Math.min(lanes.length, MAX_LANES) }
      }),
    [weeks, eventsByDate],
  )

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
        <button type="button" className="primary-button" onClick={() => setSheet({ date: selectedKey })}>
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

        <div className="cal-dow">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
            <span key={i} className="dow">
              {d}
            </span>
          ))}
        </div>

        <div className="cal-weeks">
          {weekViews.map(({ week, segments, overflow, laneCount }, wi) => (
            <div className="cal-week" key={wi}>
              <div className="cal-daynums">
                {week.map((cell, ci) => (
                  <button
                    key={cell.key}
                    type="button"
                    className={[
                      'cal-daynum',
                      cell.inMonth ? '' : 'day-out',
                      cell.key === today ? 'is-today' : '',
                      cell.key === selectedKey ? 'is-selected' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => setSelectedKey(cell.key)}
                  >
                    <span className="cal-daynum-n">{cell.dayNumber}</span>
                    {overflow[ci] > 0 && <span className="cal-overflow">+{overflow[ci]}</span>}
                  </button>
                ))}
              </div>
              <div className="cal-lanes" style={{ minHeight: laneCount * 15 }}>
                {segments.map((seg, i) => (
                  <button
                    key={`${seg.occ.id}-${i}`}
                    type="button"
                    className={[
                      'cal-bar',
                      seg.continuesLeft ? 'cont-l' : '',
                      seg.continuesRight ? 'cont-r' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    style={{
                      gridColumn: `${seg.colStart + 1} / span ${seg.colSpan}`,
                      gridRow: seg.lane + 1,
                      '--evt': dayColor(seg.occ),
                    }}
                    disabled={seg.occ.isBirthday || seg.occ.isExternal}
                    onClick={() => openOccurrence(seg.occ)}
                    title={seg.occ.title}
                  >
                    {seg.occ.title}
                  </button>
                ))}
              </div>
            </div>
          ))}
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
                      {Number.isInteger(occurrence.reminder) && <Bell size={12} aria-label="Reminder set" />}
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
          defaultDate={sheet.date || selectedKey}
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
