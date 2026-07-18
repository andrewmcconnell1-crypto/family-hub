import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Check, ChevronDown, ChevronRight, ListTodo, Paperclip, Plus } from 'lucide-react'
import Sheet from './Sheet.jsx'
import DocAttachments from './DocAttachments.jsx'
import EmptyState from './EmptyState.jsx'
import { ChildFilter, ChildMultiSelect, ChildTags } from './ChildChips.jsx'
import { matchesChild } from '../lib/familyData.js'
import { formatDateKey, todayKey } from '../utils/dateUtils.js'

export default function TodosScreen({
  tabs,
  data,
  addTodo,
  updateTodo,
  toggleTodo,
  moveTodo,
  removeTodo,
  clearDoneTodos,
}) {
  const [filter, setFilter] = useState('all')
  const [sheet, setSheet] = useState(null) // null | { todo? }
  const [showDone, setShowDone] = useState(false)

  const { active, done } = useMemo(() => {
    const visible = data.todos.filter((todo) => matchesChild(todo, filter))
    return {
      active: visible.filter((todo) => !todo.done),
      done: visible
        .filter((todo) => todo.done)
        .sort((a, b) => (b.doneAt || '').localeCompare(a.doneAt || '')),
    }
  }, [data.todos, filter])

  // Reordering is by position in the full list, so it only makes sense when
  // no child filter is hiding rows.
  const canReorder = filter === 'all'

  return (
    <div className="screen">
      <header className="screen-header screen-header-row planner-header">
        {tabs || <h1>To-dos</h1>}
        <button type="button" className="primary-button" onClick={() => setSheet({})}>
          <Plus size={18} aria-hidden="true" /> To-do
        </button>
      </header>

      <ChildFilter kids={data.children} value={filter} onChange={setFilter} />

      {active.length === 0 && done.length === 0 ? (
        <EmptyState
          icon={ListTodo}
          title="Nothing on the list"
          hint="Book the dentist, name-label the uniforms, RSVP to the party — get it out of your head and in here."
        />
      ) : (
        <section className="card">
          {active.length === 0 ? (
            <p className="muted">All done — nothing outstanding.</p>
          ) : (
            <ul className="todo-list">
              {active.map((todo, index) => (
                <TodoRow
                  key={todo.id}
                  todo={todo}
                  kids={data.children}
                  onToggle={() => toggleTodo(todo.id)}
                  onEdit={() => setSheet({ todo })}
                  onMove={
                    canReorder
                      ? {
                          up: index > 0 ? () => moveTodo(todo.id, -1) : null,
                          down: index < active.length - 1 ? () => moveTodo(todo.id, 1) : null,
                        }
                      : null
                  }
                />
              ))}
            </ul>
          )}
        </section>
      )}

      {done.length > 0 && (
        <section className="card">
          <div className="card-title-row">
            <button type="button" className="done-toggle" onClick={() => setShowDone((s) => !s)}>
              {showDone ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
              Completed ({done.length})
            </button>
            <button
              type="button"
              className="link-button"
              onClick={clearDoneTodos}
            >
              Clear
            </button>
          </div>
          {showDone && (
            <ul className="todo-list">
              {done.map((todo) => (
                <TodoRow
                  key={todo.id}
                  todo={todo}
                  kids={data.children}
                  onToggle={() => toggleTodo(todo.id)}
                  onEdit={() => setSheet({ todo })}
                  onMove={null}
                />
              ))}
            </ul>
          )}
        </section>
      )}

      {sheet && (
        <TodoSheet
          kids={data.children}
          documents={data.documents}
          todo={sheet.todo}
          onSave={(fields) => {
            if (sheet.todo) updateTodo(sheet.todo.id, fields)
            else addTodo(fields)
            setSheet(null)
          }}
          onDelete={
            sheet.todo
              ? () => {
                  removeTodo(sheet.todo.id)
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

function TodoRow({ todo, kids, onToggle, onEdit, onMove }) {
  const overdue = !todo.done && todo.dueDate && todo.dueDate < todayKey()
  return (
    <li className={`todo-row${todo.done ? ' todo-done' : ''}`}>
      <button
        type="button"
        className="todo-check"
        role="checkbox"
        aria-checked={todo.done}
        aria-label={todo.done ? `Mark “${todo.title}” not done` : `Mark “${todo.title}” done`}
        onClick={onToggle}
      >
        {todo.done && <Check size={14} aria-hidden="true" />}
      </button>
      <button type="button" className="todo-main" onClick={onEdit}>
        <span className="todo-title">{todo.title}</span>
        {(todo.dueDate || todo.childIds.length > 0 || todo.notes || todo.documentIds.length > 0) && (
          <span className="todo-meta">
            {todo.dueDate && (
              <span className={`todo-due${overdue ? ' todo-overdue' : ''}`}>
                {overdue ? 'Overdue · ' : ''}
                {formatDateKey(todo.dueDate, { weekday: true })}
              </span>
            )}
            {todo.documentIds.length > 0 && <Paperclip size={12} aria-label="Has attachments" />}
            <ChildTags kids={kids} childIds={todo.childIds} />
            {todo.notes && <span className="todo-notes">{todo.notes}</span>}
          </span>
        )}
      </button>
      {onMove && (
        <span className="todo-move">
          <button
            type="button"
            className="icon-button"
            aria-label="Move up"
            disabled={!onMove.up}
            onClick={onMove.up || undefined}
          >
            <ArrowUp size={16} />
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label="Move down"
            disabled={!onMove.down}
            onClick={onMove.down || undefined}
          >
            <ArrowDown size={16} />
          </button>
        </span>
      )}
    </li>
  )
}

function TodoSheet({ kids, documents, todo, onSave, onDelete, onClose }) {
  const [title, setTitle] = useState(todo?.title || '')
  const [dueDate, setDueDate] = useState(todo?.dueDate || '')
  const [childIds, setChildIds] = useState(todo?.childIds || [])
  const [notes, setNotes] = useState(todo?.notes || '')
  const [documentIds, setDocumentIds] = useState(todo?.documentIds || [])

  const submit = (e) => {
    e.preventDefault()
    if (!title.trim()) return
    onSave({ title: title.trim(), dueDate, childIds, notes: notes.trim(), documentIds })
  }

  return (
    <Sheet title={todo ? 'Edit to-do' : 'New to-do'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label>
          What needs doing?
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Book dentist check-up" autoFocus required />
        </label>
        <label>
          Due date
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </label>
        {kids.length > 0 && (
          <div className="form-field">
            <span className="form-label">Who's it about? <span className="label-hint">none = whole family</span></span>
            <ChildMultiSelect kids={kids} value={childIds} onChange={setChildIds} />
          </div>
        )}
        <label>
          Notes
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </label>
        <div className="form-field">
          <span className="form-label">Attachments</span>
          <DocAttachments docs={documents || []} value={documentIds} onChange={setDocumentIds} />
        </div>
        <div className="form-actions">
          {onDelete && (
            <button type="button" className="danger-button" onClick={onDelete}>
              Delete
            </button>
          )}
          <button type="submit" className="primary-button">
            Save
          </button>
        </div>
      </form>
    </Sheet>
  )
}
