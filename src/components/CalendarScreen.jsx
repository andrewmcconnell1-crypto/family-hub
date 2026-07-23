import { useMemo, useRef, useState } from 'react'
import { Bell, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Paperclip, Plus, Repeat } from 'lucide-react'
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

// Event bar lanes shown per day before the rest collapse into a "+N" badge.
const MAX_LANES = 3

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
  const [selectedKey, setSelectedKey] = useState(focus?.date || today)
  const [monthDate, setMonthDate] = useState(() => startOfMonth(parseDateKey(focus?.date || today)))
  // The month starts expanded (full grid); tapping a day collapses it to that
  // week so the day's agenda has room, iOS-style. The chevron toggles back.
  const [expanded, setExpanded] = useState(true)
  const [sheet, setSheet] = useState(() => {
    if (focus?.kind === 'event') {
      const series = data.events.find((e) => e.id === focus.id)
      if (series) return { event: series, occurrenceDate: focus.date }
    }
    return null
  })

  const weeks = useMemo(() => monthGrid(monthDate), [monthDate])

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

  const barColor = (event) => {
    if (event.isExternal) return calendarColor({ colorId: event.calendarColorId })
    const child = data.children.find((c) => event.childIds?.includes(c.id))
    return child ? childColor(child) : 'var(--accent)'
  }

  // Each week's event bars: a multi-day event is one bar spanning its columns;
  // overlapping bars stack into lanes; anything past MAX_LANES becomes "+N".
  const weekViews = useMemo(
    () =>
      weeks.map((week) => {
        const startKey = week[0].key
        const endKey = week[6].key
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
        const overflow = new Array(7).fill(0)
        const shown = segments.filter((s) => {
          if (s.lane < MAX_LANES) return true
          for (let c = s.colStart; c < s.colStart + s.colSpan; c++) overflow[c]++
          return false
        })
        return { week, segments: shown, overflow }
      }),
    [weeks, eventsByDate],
  )

  const selectedWeek = weekViews.find(({ week }) => week.some((c) => c.key === selectedKey))
  const visibleWeeks = expanded || !selectedWeek ? weekViews : [selectedWeek]
  const dayEvents = eventsByDate.get(selectedKey) || []

  // Tapping a day just selects it (the agenda below updates). The month only
  // collapses when you ask it to via the chevron — no point stealing space
  // when the day's agenda already fits.
  const selectDay = (key) => setSelectedKey(key)
  const goMonth = (delta) => {
    setMonthDate((m) => addMonths(m, delta))
    setExpanded(true)
  }

  // Swipe left/right across the calendar to change months.
  const touch = useRef(null)
  const onTouchStart = (e) => {
    const t = e.touches[0]
    touch.current = { x: t.clientX, y: t.clientY }
  }
  const onTouchEnd = (e) => {
    if (!touch.current) return
    const t = e.changedTouches[0]
    const dx = t.clientX - touch.current.x
    const dy = t.clientY - touch.current.y
    touch.current = null
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.6) goMonth(dx < 0 ? 1 : -1)
  }

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

      <div className="card calendar-card" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div className="month-nav">
          <button type="button" className="icon-button" aria-label="Previous month" onClick={() => goMonth(-1)}>
            <ChevronLeft size={20} />
          </button>
          <button
            type="button"
            className="month-title"
            aria-label={expanded ? 'Collapse month' : 'Expand month'}
            onClick={() => setExpanded((v) => !v)}
          >
            <strong>{monthLabel(monthDate)}</strong>
            {expanded ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
          </button>
          <button type="button" className="icon-button" aria-label="Next month" onClick={() => goMonth(1)}>
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
          {visibleWeeks.map(({ week, segments, overflow }, wi) => (
            <div className="cw" key={`${week[0].key}-${wi}`}>
              <div className="cw-days">
                {week.map((cell, ci) => (
                  <button
                    key={cell.key}
                    type="button"
                    className={[
                      'cw-day',
                      cell.inMonth ? '' : 'day-out',
                      cell.key === today ? 'is-today' : '',
                      cell.key === selectedKey ? 'is-selected' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    aria-label={formatDateKey(cell.key, { weekday: true })}
                    onClick={() => selectDay(cell.key)}
                  >
                    <span className="cw-num">{cell.dayNumber}</span>
                    {overflow[ci] > 0 && <span className="cw-more">+{overflow[ci]}</span>}
                  </button>
                ))}
              </div>
              <div className="cw-overlay" aria-hidden="true">
                {segments.map((seg, i) => (
                  <span
                    key={`${seg.occ.id}-${i}`}
                    className={['cw-band', seg.continuesLeft ? 'cont-l' : '', seg.continuesRight ? 'cont-r' : '']
                      .filter(Boolean)
                      .join(' ')}
                    style={{
                      gridColumn: `${seg.colStart + 1} / span ${seg.colSpan}`,
                      gridRow: seg.lane + 1,
                      '--evt': barColor(seg.occ),
                    }}
                  >
                    {seg.occ.title}
                  </span>
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
