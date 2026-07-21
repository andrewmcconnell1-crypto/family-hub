import { useEffect, useMemo, useRef, useState } from 'react'
import { Bell, Check, ChevronDown, ChevronRight, GripVertical, ListTodo, Paperclip, Plus } from 'lucide-react'
import Sheet from './Sheet.jsx'
import DocAttachments from './DocAttachments.jsx'
import EmptyState from './EmptyState.jsx'
import { ChildFilter, ChildMultiSelect, ChildTags } from './ChildChips.jsx'
import { matchesChild } from '../lib/familyData.js'
import { formatDateKey, todayKey } from '../utils/dateUtils.js'

// How long a ticked item stays visible (checked) before sliding to Completed.
const RECENT_DONE_MS = 2600

export default function TodosScreen({
  tabs,
  data,
  addTodo,
  updateTodo,
  toggleTodo,
  moveTodoToIndex,
  removeTodo,
  clearDoneTodos,
  focus,
}) {
  const [filter, setFilter] = useState('all')
  // A deep-link from Home mounts this screen fresh with `focus` set, so we seed
  // the open editor straight from it (no effect). App clears the focus on any
  // other navigation.
  const [sheet, setSheet] = useState(() => {
    if (focus?.kind === 'todo') {
      const todo = data.todos.find((t) => t.id === focus.id)
      if (todo) return { todo }
    }
    return null
  }) // null | { todo? }
  const [showDone, setShowDone] = useState(false)
  // Ids ticked in the last few seconds: they stay in the list (checked) so the
  // tick registers before the row slides down to Completed.
  const [recentlyDone, setRecentlyDone] = useState(() => new Set())
  const doneTimers = useRef(new Map())

  useEffect(
    () => () => {
      for (const timer of doneTimers.current.values()) clearTimeout(timer)
    },
    [],
  )

  const { shown, active, activeIndex, done } = useMemo(() => {
    const visible = data.todos.filter((todo) => matchesChild(todo, filter))
    const active = visible.filter((todo) => !todo.done)
    return {
      active, // truly not-done — drives reorder indices and the drag clamp
      activeIndex: new Map(active.map((todo, i) => [todo.id, i])),
      // Shown in the top card: the active ones plus any just-ticked stragglers.
      shown: visible.filter((todo) => !todo.done || recentlyDone.has(todo.id)),
      done: visible
        .filter((todo) => todo.done && !recentlyDone.has(todo.id))
        .sort((a, b) => (b.doneAt || '').localeCompare(a.doneAt || '')),
    }
  }, [data.todos, filter, recentlyDone])

  const forgetRecent = (id) =>
    setRecentlyDone((prev) => {
      if (!prev.has(id)) return prev
      const next = new Set(prev)
      next.delete(id)
      return next
    })

  // Tick / untick with a grace period so a completed item doesn't vanish the
  // instant you check it.
  const handleToggle = (todo) => {
    toggleTodo(todo.id)
    const existing = doneTimers.current.get(todo.id)
    if (existing) {
      clearTimeout(existing)
      doneTimers.current.delete(todo.id)
    }
    if (!todo.done) {
      setRecentlyDone((prev) => new Set(prev).add(todo.id))
      doneTimers.current.set(
        todo.id,
        setTimeout(() => {
          doneTimers.current.delete(todo.id)
          forgetRecent(todo.id)
        }, RECENT_DONE_MS),
      )
    } else {
      forgetRecent(todo.id)
    }
  }

  // Reordering is by position in the full list, so it only makes sense when
  // no child filter is hiding rows.
  const canReorder = filter === 'all'

  // Drag-to-reorder: grabbing the handle live-reorders the list as the finger
  // crosses row boundaries (the row heights are uniform enough to step by).
  const dragRef = useRef(null) // { id, index, pointerId, startY, rowH }
  const [draggingId, setDraggingId] = useState(null)

  const startDrag = (e, id, index) => {
    e.preventDefault()
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // Synthetic pointers (tests) can't be captured.
    }
    const row = e.currentTarget.closest('li')
    dragRef.current = {
      id,
      index,
      pointerId: e.pointerId,
      startY: e.clientY,
      rowH: row ? row.getBoundingClientRect().height : 52,
    }
    setDraggingId(id)
  }

  const dragMove = (e) => {
    const drag = dragRef.current
    if (!drag || e.pointerId !== drag.pointerId) return
    const delta = Math.round((e.clientY - drag.startY) / drag.rowH)
    const target = Math.max(0, Math.min(active.length - 1, drag.index + delta))
    if (target !== drag.index) {
      moveTodoToIndex(drag.id, target)
      drag.startY += (target - drag.index) * drag.rowH
      drag.index = target
    }
  }

  const endDrag = (e) => {
    if (dragRef.current?.pointerId === e.pointerId) {
      dragRef.current = null
      setDraggingId(null)
    }
  }

  return (
    <div className="screen">
      <header className="screen-header screen-header-row planner-header">
        {tabs || <h1>To-dos</h1>}
        <button type="button" className="primary-button" onClick={() => setSheet({})}>
          <Plus size={18} aria-hidden="true" /> To-do
        </button>
      </header>

      <ChildFilter kids={data.children} value={filter} onChange={setFilter} />

      {shown.length === 0 && done.length === 0 ? (
        <EmptyState
          icon={ListTodo}
          title="Nothing on the list"
          hint="Book the dentist, name-label the uniforms, RSVP to the party — get it out of your head and in here."
        />
      ) : (
        <section className="card">
          {shown.length === 0 ? (
            <p className="muted">All done — nothing outstanding.</p>
          ) : (
            <ul className="todo-list">
              {shown.map((todo) => (
                <TodoRow
                  key={todo.id}
                  todo={todo}
                  kids={data.children}
                  dragging={draggingId === todo.id}
                  onToggle={() => handleToggle(todo)}
                  onEdit={() => setSheet({ todo })}
                  dragHandlers={
                    canReorder && !todo.done
                      ? {
                          onPointerDown: (e) => startDrag(e, todo.id, activeIndex.get(todo.id)),
                          onPointerMove: dragMove,
                          onPointerUp: endDrag,
                          onPointerCancel: endDrag,
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
                  onToggle={() => handleToggle(todo)}
                  onEdit={() => setSheet({ todo })}
                  dragHandlers={null}
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

function TodoRow({ todo, kids, dragging, onToggle, onEdit, dragHandlers }) {
  const overdue = !todo.done && todo.dueDate && todo.dueDate < todayKey()
  return (
    <li className={`todo-row${todo.done ? ' todo-done' : ''}${dragging ? ' todo-dragging' : ''}`}>
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
            {todo.remind && todo.dueDate && !todo.done && <Bell size={12} aria-label="Reminder set" />}
            {todo.documentIds.length > 0 && <Paperclip size={12} aria-label="Has attachments" />}
            <ChildTags kids={kids} childIds={todo.childIds} />
            {todo.notes && <span className="todo-notes">{todo.notes}</span>}
          </span>
        )}
      </button>
      {dragHandlers && (
        <button
          type="button"
          className="icon-button todo-drag-handle"
          aria-label={`Reorder “${todo.title}”`}
          {...dragHandlers}
        >
          <GripVertical size={18} />
        </button>
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
  const [remind, setRemind] = useState(todo?.remind || false)

  const submit = (e) => {
    e.preventDefault()
    if (!title.trim()) return
    onSave({
      title: title.trim(),
      dueDate,
      childIds,
      notes: notes.trim(),
      documentIds,
      remind: dueDate ? remind : false,
    })
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
        {dueDate && (
          <label className="checkbox-row">
            <input type="checkbox" checked={remind} onChange={(e) => setRemind(e.target.checked)} />
            Remind me on the due date
          </label>
        )}
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
