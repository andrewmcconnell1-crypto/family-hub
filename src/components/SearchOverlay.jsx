import { useMemo, useState } from 'react'
import { CalendarDays, FileText, Image, ListTodo, Search, Users, X } from 'lucide-react'
import { REPEAT_OPTIONS } from '../utils/recurrence.js'
import { formatDateKey } from '../utils/dateUtils.js'
import { useFileUrl } from '../hooks/useFileUrl.js'

const matches = (query) => (text) => (text || '').toLowerCase().includes(query)

// One box that finds anything in the hub: members, events, to-dos, documents
// and photo captions. Documents open directly; everything else jumps to its
// tab.
export default function SearchOverlay({ data, onNavigate, onClose }) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()

  const results = useMemo(() => {
    if (q.length < 2) return null
    const hit = matches(q)
    return {
      members: data.children.filter((c) => hit(c.name)),
      events: data.events.filter((e) => hit(e.title) || hit(e.notes)),
      todos: data.todos.filter((t) => hit(t.title) || hit(t.notes)),
      documents: data.documents.filter(
        (d) => hit(d.title) || hit(d.notes) || hit(d.fileName),
      ),
      photos: data.photos.filter((p) => hit(p.caption)),
    }
  }, [data, q])

  const empty =
    results &&
    Object.values(results).every((list) => list.length === 0)

  const go = (tab) => {
    onNavigate(tab)
    onClose()
  }

  return (
    <div className="search-overlay" role="dialog" aria-modal="true" aria-label="Search">
      <div className="search-bar">
        <Search size={18} aria-hidden="true" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search everything…"
          autoFocus
          aria-label="Search everything"
        />
        <button type="button" className="icon-button" aria-label="Close search" onClick={onClose}>
          <X size={20} />
        </button>
      </div>

      {!results && (
        <p className="muted search-hint">
          Type at least two letters — searches members, events, to-dos, documents and photo
          captions.
        </p>
      )}
      {empty && <p className="muted search-hint">Nothing matches “{query.trim()}”.</p>}

      {results && results.members.length > 0 && (
        <SearchGroup title="Family">
          {results.members.map((member) => (
            <ResultRow
              key={member.id}
              icon={Users}
              title={member.name}
              onClick={() => go('family')}
            />
          ))}
        </SearchGroup>
      )}

      {results && results.events.length > 0 && (
        <SearchGroup title="Events">
          {results.events.map((event) => (
            <ResultRow
              key={event.id}
              icon={CalendarDays}
              title={event.title}
              sub={
                event.repeat !== 'none'
                  ? REPEAT_OPTIONS.find((r) => r.id === event.repeat)?.label
                  : formatDateKey(event.date, { weekday: true })
              }
              onClick={() => go('calendar')}
            />
          ))}
        </SearchGroup>
      )}

      {results && results.todos.length > 0 && (
        <SearchGroup title="To-dos">
          {results.todos.map((todo) => (
            <ResultRow
              key={todo.id}
              icon={ListTodo}
              title={todo.title}
              sub={todo.done ? 'done' : todo.dueDate ? `due ${formatDateKey(todo.dueDate)}` : null}
              onClick={() => go('todos')}
            />
          ))}
        </SearchGroup>
      )}

      {results && results.documents.length > 0 && (
        <SearchGroup title="Documents">
          {results.documents.map((doc) => (
            <DocResultRow key={doc.id} doc={doc} />
          ))}
        </SearchGroup>
      )}

      {results && results.photos.length > 0 && (
        <SearchGroup title="Photos">
          {results.photos.map((photo) => (
            <ResultRow
              key={photo.id}
              icon={Image}
              title={photo.caption}
              onClick={() => go('photos')}
            />
          ))}
        </SearchGroup>
      )}
    </div>
  )
}

function SearchGroup({ title, children }) {
  return (
    <section className="card search-group">
      <h2>{title}</h2>
      <ul className="search-list">{children}</ul>
    </section>
  )
}

function ResultRow({ icon: Icon, title, sub, onClick }) {
  return (
    <li>
      <button type="button" className="search-result" onClick={onClick}>
        <Icon size={16} aria-hidden="true" />
        <span className="search-result-title">{title}</span>
        {sub && <span className="muted">{sub}</span>}
      </button>
    </li>
  )
}

// Documents open right from the results.
function DocResultRow({ doc }) {
  const url = useFileUrl(doc.fileId)
  return (
    <li>
      {url ? (
        <a
          className="search-result"
          href={url}
          target="_blank"
          rel="noreferrer"
          download={doc.fileName}
        >
          <FileText size={16} aria-hidden="true" />
          <span className="search-result-title">{doc.title}</span>
          <span className="muted">open</span>
        </a>
      ) : (
        <span className="search-result">
          <FileText size={16} aria-hidden="true" />
          <span className="search-result-title">{doc.title}</span>
        </span>
      )}
    </li>
  )
}
