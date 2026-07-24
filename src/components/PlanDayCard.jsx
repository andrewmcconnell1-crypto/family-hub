import { useState } from 'react'
import { CalendarDays, Plus, X } from 'lucide-react'
import { ChildTags } from './ChildChips.jsx'
import { childColor } from '../lib/familyData.js'
import { dayParts } from '../utils/dateUtils.js'

// One day of the weekly planning board: that day's calendar events as light
// context on top, then the jotted plan notes (person-tagged, tap to edit),
// then a quick inline add. Shared by the Week tab and Home's "This week".
export default function PlanDayCard({
  day,
  people,
  isToday,
  onOpenEvent,
  lockSynthetic = false,
  onAddPlan,
  onUpdatePlan,
  onRemovePlan,
}) {
  const parts = dayParts(day.key)
  const [editingId, setEditingId] = useState(null)

  return (
    <section className={`card plan-day${isToday ? ' week-day-today' : ''}`}>
      <div className="plan-day-head">
        <span className="date-leaf" aria-hidden="true">
          <span className="date-leaf-dow">{parts.dow}</span>
          <span className="date-leaf-num">{parts.num}</span>
        </span>
        <h2 className="plan-day-title">
          {parts.weekdayLong}
          {isToday && <span className="today-chip">Today</span>}
        </h2>
      </div>

      {day.events.length > 0 && (
        <ul className="plan-events">
          {day.events.map((occurrence) => {
            const disabled = (lockSynthetic && (occurrence.isBirthday || occurrence.isExternal)) || !onOpenEvent
            return (
              <li key={`${occurrence.id}-${occurrence.date}`}>
                <button
                  type="button"
                  className="plan-event"
                  disabled={disabled}
                  onClick={() => onOpenEvent && onOpenEvent(occurrence)}
                >
                  <CalendarDays size={13} aria-hidden="true" className="plan-event-icon" />
                  {occurrence.time && <span className="plan-event-time">{occurrence.time}</span>}
                  <span className="plan-event-title">{occurrence.title}</span>
                  {occurrence.isExternal && <span className="external-tag">{occurrence.calendarName}</span>}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {day.plans.length > 0 && (
        <ul className="plan-items">
          {day.plans.map((plan) => {
            if (editingId === plan.id) {
              return (
                <li key={plan.id}>
                  <PlanNoteForm
                    people={people}
                    initialText={plan.text}
                    initialChildIds={plan.childIds || []}
                    submitLabel="Save"
                    cancelLabel="Cancel"
                    onSubmit={(fields) => {
                      onUpdatePlan(plan.id, fields)
                      setEditingId(null)
                    }}
                    onCancel={() => setEditingId(null)}
                  />
                </li>
              )
            }
            const person = people.find((c) => plan.childIds?.includes(c.id))
            return (
              <li
                key={plan.id}
                className="plan-item"
                style={person ? { borderLeftColor: childColor(person) } : undefined}
              >
                <button
                  type="button"
                  className="plan-item-text"
                  onClick={() => onUpdatePlan && setEditingId(plan.id)}
                >
                  {plan.text}
                </button>
                <ChildTags kids={people} childIds={plan.childIds} />
                <button
                  type="button"
                  className="plan-item-remove"
                  aria-label={`Remove “${plan.text}”`}
                  onClick={() => onRemovePlan(plan.id)}
                >
                  <X size={15} />
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <PlanAdder people={people} onAdd={onAddPlan} />
    </section>
  )
}

// The add row: a button that opens the note form, which stays open after each
// add so you can rattle off several notes in a row.
function PlanAdder({ people, onAdd }) {
  const [open, setOpen] = useState(false)
  if (!open) {
    return (
      <button type="button" className="plan-add-btn" onClick={() => setOpen(true)}>
        <Plus size={15} aria-hidden="true" /> Add
      </button>
    )
  }
  return (
    <PlanNoteForm
      people={people}
      submitLabel="Add"
      cancelLabel="Done"
      clearOnSubmit
      onSubmit={onAdd}
      onCancel={() => setOpen(false)}
    />
  )
}

// Shared text + person-chips form used for both adding and editing a note.
function PlanNoteForm({
  people,
  initialText = '',
  initialChildIds = [],
  submitLabel,
  cancelLabel,
  clearOnSubmit = false,
  onSubmit,
  onCancel,
}) {
  const [text, setText] = useState(initialText)
  const [childIds, setChildIds] = useState(initialChildIds)

  const toggle = (id) =>
    setChildIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))

  const submit = (e) => {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed) return
    onSubmit({ text: trimmed, childIds })
    if (clearOnSubmit) {
      setText('')
      setChildIds([])
    }
  }

  return (
    <form className="plan-add-form" onSubmit={submit}>
      <input
        className="plan-add-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="e.g. Dom running early"
        autoFocus
      />
      {people.length > 0 && (
        <div className="plan-who">
          {people.map((person) => {
            const on = childIds.includes(person.id)
            const color = childColor(person)
            return (
              <button
                type="button"
                key={person.id}
                className={`plan-who-chip${on ? ' is-on' : ''}`}
                style={on ? { background: color, borderColor: color, color: '#fff' } : { borderColor: color, color }}
                onClick={() => toggle(person.id)}
              >
                {person.name}
              </button>
            )
          })}
        </div>
      )}
      <div className="plan-add-actions">
        <button type="button" className="link-button" onClick={onCancel}>
          {cancelLabel}
        </button>
        <button type="submit" className="secondary-button plan-add-save" disabled={!text.trim()}>
          {submitLabel}
        </button>
      </div>
    </form>
  )
}
