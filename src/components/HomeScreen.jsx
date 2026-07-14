import { CalendarDays, FolderOpen, Image } from 'lucide-react'
import Avatar from './Avatar.jsx'
import { ChildTags } from './ChildChips.jsx'
import { formatDateKey, todayKey, upcomingEvents } from '../utils/dateUtils.js'
import { useFileUrl } from '../hooks/useFileUrl.js'

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export default function HomeScreen({ data, onNavigate }) {
  const today = todayKey()
  const week = upcomingEvents(data.events, today, 7)
  const recentPhotos = data.photos.slice(0, 6)
  const activeTodos = data.todos.filter((todo) => !todo.done)

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

      <section className="card">
        <div className="card-title-row">
          <h2>Next 7 days</h2>
          <button type="button" className="link-button" onClick={() => onNavigate('calendar')}>
            Calendar
          </button>
        </div>
        {week.length === 0 ? (
          <p className="muted">Nothing on — enjoy the quiet week.</p>
        ) : (
          <ul className="event-list">
            {week.map((event) => (
              <li key={event.id} className="event-row">
                <div className="event-when">
                  <span className="event-date">{formatDateKey(event.date, { weekday: true })}</span>
                  {event.time && <span className="event-time">{event.time}</span>}
                </div>
                <div className="event-main">
                  <span className="event-title">{event.title}</span>
                  <ChildTags kids={data.children} childIds={event.childIds} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {activeTodos.length > 0 && (
        <section className="card">
          <div className="card-title-row">
            <h2>To-dos</h2>
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
          {activeTodos.length > 3 && (
            <p className="muted">+ {activeTodos.length - 3} more</p>
          )}
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
