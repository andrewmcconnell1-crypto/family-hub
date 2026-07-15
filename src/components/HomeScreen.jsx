import { AlertCircle, CalendarDays, FolderOpen, Image } from 'lucide-react'
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

  const todayEvents = thisWeek.filter((o) => o.date === today)
  const todosDueToday = data.todos.filter((t) => !t.done && t.dueDate === today)
  const overdueTodos = data.todos.filter((t) => !t.done && t.dueDate && t.dueDate < today)
  const activeTodos = data.todos.filter((t) => !t.done)
  const recentPhotos = data.photos.slice(0, 6)

  // Remaining days of this week, condensed to a line each (events + due to-dos).
  const laterDays = []
  for (let key = addDays(today, 1); key <= weekEnd; key = addDays(key, 1)) {
    const items = [
      ...thisWeek.filter((o) => o.date === key).map((o) => o.title),
      ...data.todos.filter((t) => !t.done && t.dueDate === key).map((t) => `☐ ${t.title}`),
    ]
    if (items.length > 0) laterDays.push({ key, items })
  }

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

      <section className="card">
        <div className="card-title-row">
          <h2>Today</h2>
          <button type="button" className="link-button" onClick={() => onNavigate('week')}>
            This week
          </button>
        </div>
        {todayEvents.length === 0 && todosDueToday.length === 0 ? (
          <p className="muted">Nothing on today.</p>
        ) : (
          <ul className="event-list">
            {todayEvents.map((event) => (
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
                  <ChildTags kids={data.children} childIds={event.childIds} />
                </div>
              </li>
            ))}
            {todosDueToday.map((todo) => (
              <li key={todo.id} className="event-row">
                <div className="event-when">
                  <span className="event-time muted">to-do</span>
                </div>
                <div className="event-main">
                  <span className="event-title">{todo.title}</span>
                  <ChildTags kids={data.children} childIds={todo.childIds} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {laterDays.length > 0 && (
        <section className="card">
          <div className="card-title-row">
            <h2>Later this week</h2>
            <button type="button" className="link-button" onClick={() => onNavigate('week')}>
              Full week
            </button>
          </div>
          <ul className="home-week-list">
            {laterDays.map((day) => (
              <li key={day.key}>
                <span className="home-week-day">{formatDateKey(day.key, { weekday: true })}</span>
                <span className="home-week-items">{day.items.join(' · ')}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

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

      <div className="stat-row">
        <button type="button" className="stat-tile" onClick={() => onNavigate('calendar')}>
          <CalendarDays size={20} aria-hidden="true" />
          <strong>{data.events.length}</strong>
          <span>events</span>
        </button>
        <button type="button" className="stat-tile" onClick={() => onNavigate('documents')}>
          <FolderOpen size={20} aria-hidden="true" />
          <strong>{data.documents.length}</strong>
          <span>documents</span>
        </button>
        <button type="button" className="stat-tile" onClick={() => onNavigate('photos')}>
          <Image size={20} aria-hidden="true" />
          <strong>{data.photos.length}</strong>
          <span>photos</span>
        </button>
      </div>
    </div>
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
