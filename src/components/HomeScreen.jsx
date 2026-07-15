import { useState } from 'react'
import { AlertCircle, ChevronDown, ChevronRight } from 'lucide-react'
import Avatar from './Avatar.jsx'
import { ChildTags } from './ChildChips.jsx'
import { addDays, formatDateKey, parseDateKey, todayKey } from '../utils/dateUtils.js'
import { birthdayOccurrences, calendarOccurrences, weekdayIndex } from '../utils/recurrence.js'
import { useFileUrl } from '../hooks/useFileUrl.js'

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

// Bistro-style dashboard: today front and centre, the rest of the week
// condensed, plus highlights (overdue to-dos, next birthday, top priorities).
// The Planner holds the detail; everything here links into it.
export default function HomeScreen({ data, onNavigate }) {
  const today = todayKey()
  const weekEnd = addDays(today, 6 - weekdayIndex(today)) // Sunday of this week
  const thisWeek = calendarOccurrences(data, today, weekEnd)

  const overdueTodos = data.todos.filter((t) => !t.done && t.dueDate && t.dueDate < today)
  const activeTodos = data.todos.filter((t) => !t.done)
  const recentPhotos = data.photos.slice(0, 6)

  // A card per remaining day of this week (today included).
  const weekDays = []
  for (let key = today; key <= weekEnd; key = addDays(key, 1)) {
    weekDays.push({
      key,
      events: thisWeek.filter((o) => o.date === key),
      todos: data.todos.filter((t) => !t.done && t.dueDate === key),
    })
  }
  // Today starts expanded; tap a day's header to toggle it.
  const [expandedDays, setExpandedDays] = useState(() => new Set([today]))
  const toggleDay = (key) =>
    setExpandedDays((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const nextBirthday = birthdayOccurrences(data.children, addDays(today, 1), addDays(today, 60))[0]
  const daysToBirthday = nextBirthday
    ? Math.round((parseDateKey(nextBirthday.date) - parseDateKey(today)) / 86400000)
    : null

  return (
    <div className="screen">
      <header className="screen-header">
        <p className="eyebrow">{formatDateKey(today, { long: true })}</p>
        <h1>{greeting()}</h1>
      </header>

      {data.children.length > 0 && (
        <div className="home-kids">
          {data.children.map((child) => (
            <div key={child.id} className="home-kid">
              <Avatar child={child} size={44} />
              <span>{child.name}</span>
            </div>
          ))}
        </div>
      )}

      {data.children.length === 0 && (
        <button type="button" className="card card-cta" onClick={() => onNavigate('family')}>
          <strong>Start by adding your family</strong>
          <span>Everything in Treehouse — events, documents, photos — can be tagged to them.</span>
        </button>
      )}

      {overdueTodos.length > 0 && (
        <button type="button" className="card attention-card" onClick={() => onNavigate('todos')}>
          <span className="attention-title">
            <AlertCircle size={16} aria-hidden="true" />
            Needs attention
          </span>
          {overdueTodos.slice(0, 3).map((todo) => (
            <span key={todo.id} className="attention-item">
              {todo.title} — due {formatDateKey(todo.dueDate, { weekday: true })}
            </span>
          ))}
          {overdueTodos.length > 3 && (
            <span className="muted">+ {overdueTodos.length - 3} more overdue</span>
          )}
        </button>
      )}

      <div className="card-title-row week-strip-header">
        <h2>This week</h2>
        <button type="button" className="link-button" onClick={() => onNavigate('week')}>
          Planner
        </button>
      </div>
      {weekDays.map((day) => (
        <DayCard
          key={day.key}
          day={day}
          isToday={day.key === today}
          kids={data.children}
          expanded={expandedDays.has(day.key)}
          onToggle={() => toggleDay(day.key)}
        />
      ))}

      {nextBirthday && (
        <button type="button" className="card bday-card" onClick={() => onNavigate('calendar')}>
          <span className="bday-title">{nextBirthday.title}</span>
          <span className="muted">
            {formatDateKey(nextBirthday.date, { weekday: true })} — in {daysToBirthday}{' '}
            {daysToBirthday === 1 ? 'day' : 'days'}
          </span>
        </button>
      )}

      {activeTodos.length > 0 && (
        <section className="card">
          <div className="card-title-row">
            <h2>To-do priorities</h2>
            <button type="button" className="link-button" onClick={() => onNavigate('todos')}>
              All to-dos
            </button>
          </div>
          <ul className="home-todo-list">
            {activeTodos.slice(0, 3).map((todo) => (
              <li key={todo.id}>
                <span className="home-todo-dot" aria-hidden="true" />
                <span className="home-todo-title">{todo.title}</span>
                {todo.dueDate && (
                  <span className={`todo-due${todo.dueDate < today ? ' todo-overdue' : ''}`}>
                    {formatDateKey(todo.dueDate)}
                  </span>
                )}
              </li>
            ))}
          </ul>
          {activeTodos.length > 3 && <p className="muted">+ {activeTodos.length - 3} more</p>}
        </section>
      )}

      <section className="card">
        <div className="card-title-row">
          <h2>Recent photos</h2>
          <button type="button" className="link-button" onClick={() => onNavigate('photos')}>
            All photos
          </button>
        </div>
        {recentPhotos.length === 0 ? (
          <p className="muted">No photos yet — add the first one from the Photos tab.</p>
        ) : (
          <div className="photo-strip">
            {recentPhotos.map((photo) => (
              <PhotoThumb key={photo.id} photo={photo} />
            ))}
          </div>
        )}
      </section>

    </div>
  )
}

// One Bistro-style card per day: collapsed it's a single summary line, tapped
// open it shows the full rows (times, tags, due to-dos).
function DayCard({ day, isToday, kids, expanded, onToggle }) {
  const count = day.events.length + day.todos.length
  const summary = [
    ...day.events.map((e) => e.title),
    ...day.todos.map((t) => `☐ ${t.title}`),
  ].join(' · ')

  return (
    <section className={`card day-card${isToday ? ' week-day-today' : ''}`}>
      <button
        type="button"
        className="day-card-header"
        aria-expanded={expanded}
        disabled={count === 0}
        onClick={onToggle}
      >
        <span className="day-card-title">
          {formatDateKey(day.key, { weekday: true })}
          {isToday && <span className="today-chip">Today</span>}
        </span>
        {!expanded && (
          <span className={`day-card-summary${count === 0 ? ' muted' : ''}`}>
            {count === 0 ? 'Nothing on' : summary}
          </span>
        )}
        {count > 0 &&
          (expanded ? (
            <ChevronDown size={18} aria-hidden="true" />
          ) : (
            <ChevronRight size={18} aria-hidden="true" />
          ))}
      </button>
      {expanded && count > 0 && (
        <ul className="event-list day-card-body">
          {day.events.map((event) => (
            <li key={`${event.id}-${event.date}`} className="event-row">
              <div className="event-when">
                {event.time ? (
                  <span className="event-time">{event.time}</span>
                ) : (
                  <span className="event-time muted">all day</span>
                )}
              </div>
              <div className="event-main">
                <span className="event-title">{event.title}</span>
                <ChildTags kids={kids} childIds={event.childIds} />
              </div>
            </li>
          ))}
          {day.todos.map((todo) => (
            <li key={todo.id} className="event-row">
              <div className="event-when">
                <span className="event-time muted">to-do</span>
              </div>
              <div className="event-main">
                <span className="event-title">{todo.title}</span>
                <ChildTags kids={kids} childIds={todo.childIds} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function PhotoThumb({ photo }) {
  const url = useFileUrl(photo.fileId)
  return url ? (
    <img className="photo-strip-thumb" src={url} alt={photo.caption || 'Family photo'} />
  ) : (
    <span className="photo-strip-thumb photo-placeholder" />
  )
}
