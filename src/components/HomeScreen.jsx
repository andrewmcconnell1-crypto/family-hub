import { useState } from 'react'
import { AlertCircle, Search } from 'lucide-react'
import SearchOverlay from './SearchOverlay.jsx'
import PhotoViewer from './PhotoViewer.jsx'
import PlanDayCard from './PlanDayCard.jsx'
import Wordmark from './Wordmark.jsx'
import { expiringDocuments } from '../lib/familyData.js'
import { addDays, formatDateKey, parseDateKey, todayKey } from '../utils/dateUtils.js'
import { birthdayOccurrences, calendarOccurrences, weekdayIndex } from '../utils/recurrence.js'
import { useFileUrl } from '../hooks/useFileUrl.js'

// Bistro-style dashboard: today front and centre, the rest of the week as the
// planning board, plus highlights (overdue to-dos, next birthday, priorities).
// The Planner holds the detail; everything here links into it.
export default function HomeScreen({
  data,
  onNavigate,
  onOpen,
  addPlanItem,
  removePlanItem,
  externalOccurrences,
}) {
  const today = todayKey()
  const weekEnd = addDays(today, 6 - weekdayIndex(today)) // Sunday of this week
  const thisWeek = [
    ...calendarOccurrences(data, today, weekEnd),
    ...(externalOccurrences ? externalOccurrences(today, weekEnd) : []),
  ].sort((a, b) =>
    a.date === b.date
      ? (a.time || '99:99').localeCompare(b.time || '99:99')
      : a.date.localeCompare(b.date),
  )

  const overdueTodos = data.todos.filter((t) => !t.done && t.dueDate && t.dueDate < today)
  const expiringDocs = expiringDocuments(data.documents, today, addDays(today, 30))
  const activeTodos = data.todos.filter((t) => !t.done)
  const recentPhotos = data.photos.slice(0, 6)

  // A planning-board card per remaining day of this week (today included).
  const weekDays = []
  for (let key = today; key <= weekEnd; key = addDays(key, 1)) {
    weekDays.push({
      key,
      events: thisWeek.filter((o) => o.date === key),
      plans: (data.weekPlans || []).filter((p) => p.date === key),
    })
  }
  const [searching, setSearching] = useState(false)
  const [viewingPhotoId, setViewingPhotoId] = useState(null)
  const viewingPhoto = viewingPhotoId ? data.photos.find((p) => p.id === viewingPhotoId) : null

  const openEvent = (o) =>
    onOpen(
      o.isBirthday || o.isExternal
        ? { type: 'date', date: o.date }
        : { type: 'event', id: o.id, date: o.date },
    )

  const nextBirthday = birthdayOccurrences(data.children, addDays(today, 1), addDays(today, 60))[0]
  const daysToBirthday = nextBirthday
    ? Math.round((parseDateKey(nextBirthday.date) - parseDateKey(today)) / 86400000)
    : null

  return (
    <div className="screen">
      <div className="home-masthead">
        <Wordmark className="home-wordmark" />
        <p className="masthead-date">{formatDateKey(today, { weekday: true })}</p>
        <button
          type="button"
          className="icon-button search-button"
          aria-label="Search everything"
          onClick={() => setSearching(true)}
        >
          <Search size={22} />
        </button>
      </div>

      {activeTodos.length > 0 && (
        <section className="card notepad-card">
          <div className="card-title-row">
            <h2>To-do priorities</h2>
            <button type="button" className="link-button" onClick={() => onNavigate('todos')}>
              All to-dos
            </button>
          </div>
          <ul className="home-todo-list">
            {activeTodos.slice(0, 4).map((todo) => (
              <li key={todo.id}>
                <button
                  type="button"
                  className="home-todo-button"
                  onClick={() => onOpen({ type: 'todo', id: todo.id })}
                >
                  <span className="home-todo-dot" aria-hidden="true" />
                  <span className="home-todo-title">{todo.title}</span>
                  {todo.dueDate && (
                    <span className={`todo-due${todo.dueDate < today ? ' todo-overdue' : ''}`}>
                      {formatDateKey(todo.dueDate)}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
          {activeTodos.length > 4 && <p className="muted">+ {activeTodos.length - 4} more</p>}
        </section>
      )}

      {data.children.length === 0 && (
        <button type="button" className="card card-cta" onClick={() => onNavigate('family')}>
          <strong>Start by adding your family</strong>
          <span>Everything in Nest — events, documents, photos — can be tagged to them.</span>
        </button>
      )}

      {(overdueTodos.length > 0 || expiringDocs.length > 0) && (
        <section className="card attention-card">
          <span className="attention-title">
            <AlertCircle size={16} aria-hidden="true" />
            Needs attention
          </span>
          {overdueTodos.slice(0, 3).map((todo) => (
            <button
              key={todo.id}
              type="button"
              className="attention-item attention-item-button"
              onClick={() => onOpen({ type: 'todo', id: todo.id })}
            >
              {todo.title} — due {formatDateKey(todo.dueDate, { weekday: true })}
            </button>
          ))}
          {overdueTodos.length > 3 && (
            <button type="button" className="attention-item-button muted" onClick={() => onNavigate('todos')}>
              + {overdueTodos.length - 3} more overdue
            </button>
          )}
          {expiringDocs.slice(0, 3).map((doc) => (
            <button
              key={doc.id}
              type="button"
              className="attention-item attention-item-button"
              onClick={() => onNavigate('documents')}
            >
              {doc.title} — {doc.expiryDate < today ? 'expired' : 'expires'}{' '}
              {formatDateKey(doc.expiryDate)}
            </button>
          ))}
          {expiringDocs.length > 3 && (
            <button type="button" className="attention-item-button muted" onClick={() => onNavigate('documents')}>
              + {expiringDocs.length - 3} more expiring
            </button>
          )}
        </section>
      )}

      <div className="card-title-row week-strip-header">
        <h2>This week</h2>
        <button type="button" className="link-button" onClick={() => onNavigate('week')}>
          Planner
        </button>
      </div>
      {weekDays.map((day) => (
        <PlanDayCard
          key={day.key}
          day={day}
          people={data.children}
          isToday={day.key === today}
          onOpenEvent={openEvent}
          onAddPlan={({ text, childIds }) => addPlanItem({ date: day.key, text, childIds })}
          onRemovePlan={removePlanItem}
        />
      ))}

      {nextBirthday && (
        <button
          type="button"
          className="card bday-card"
          onClick={() => onOpen({ type: 'date', date: nextBirthday.date })}
        >
          <span className="bday-title">{nextBirthday.title}</span>
          <span className="muted">
            {formatDateKey(nextBirthday.date, { weekday: true })} — in {daysToBirthday}{' '}
            {daysToBirthday === 1 ? 'day' : 'days'}
          </span>
        </button>
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
              <PhotoThumb key={photo.id} photo={photo} onOpen={() => setViewingPhotoId(photo.id)} />
            ))}
          </div>
        )}
      </section>

      {viewingPhoto && (
        <PhotoViewer
          photo={viewingPhoto}
          kids={data.children}
          onClose={() => setViewingPhotoId(null)}
        />
      )}

      {searching && (
        <SearchOverlay data={data} onNavigate={onNavigate} onClose={() => setSearching(false)} />
      )}
    </div>
  )
}

function PhotoThumb({ photo, onOpen }) {
  const url = useFileUrl(photo.fileId)
  return (
    <button
      type="button"
      className="photo-strip-thumb-button"
      onClick={onOpen}
      aria-label={photo.caption || 'View photo'}
    >
      {url ? (
        <img className="photo-strip-thumb" src={url} alt={photo.caption || 'Family photo'} />
      ) : (
        <span className="photo-strip-thumb photo-placeholder" />
      )}
    </button>
  )
}
