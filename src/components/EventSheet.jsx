import { useState } from 'react'
import Sheet from './Sheet.jsx'
import { ChildMultiSelect } from './ChildChips.jsx'
import { EVENT_CATEGORIES } from '../lib/familyData.js'
import { REPEAT_OPTIONS, WEEKDAY_LABELS, weekdayIndex } from '../utils/recurrence.js'
import { formatDateKey } from '../utils/dateUtils.js'

// Add/edit form for events, shared by the Week and Calendar views. Editing a
// recurring event edits the whole series; onSkipDay removes just the
// occurrence it was opened from.
export default function EventSheet({
  kids,
  event,
  occurrenceDate,
  defaultDate,
  onSave,
  onDelete,
  onSkipDay,
  onClose,
}) {
  const [title, setTitle] = useState(event?.title || '')
  const [date, setDate] = useState(event?.date || defaultDate)
  const [time, setTime] = useState(event?.time || '')
  const [category, setCategory] = useState(event?.category || 'other')
  const [childIds, setChildIds] = useState(event?.childIds || [])
  const [notes, setNotes] = useState(event?.notes || '')
  const [repeat, setRepeat] = useState(event?.repeat || 'none')
  const [weekdays, setWeekdays] = useState(event?.weekdays || [])
  const [endDate, setEndDate] = useState(event?.endDate || '')

  const pickDays = repeat === 'weekly' || repeat === 'fortnightly'

  const changeRepeat = (next) => {
    setRepeat(next)
    if ((next === 'weekly' || next === 'fortnightly') && weekdays.length === 0 && date) {
      setWeekdays([weekdayIndex(date)])
    }
  }

  const toggleWeekday = (dayIndex) =>
    setWeekdays((days) =>
      days.includes(dayIndex) ? days.filter((d) => d !== dayIndex) : [...days, dayIndex].sort(),
    )

  const submit = (e) => {
    e.preventDefault()
    if (!title.trim() || !date) return
    onSave({
      title: title.trim(),
      date,
      time,
      category,
      childIds,
      notes: notes.trim(),
      repeat,
      weekdays: pickDays ? weekdays : [],
      endDate: repeat === 'none' ? '' : endDate,
    })
  }

  return (
    <Sheet title={event ? 'Edit event' : 'New event'} onClose={onClose}>
      {event && event.repeat !== 'none' && (
        <p className="muted series-note">
          Repeating event — changes apply to the whole series
          {occurrenceDate ? ` (opened from ${formatDateKey(occurrenceDate, { weekday: true })})` : ''}.
        </p>
      )}
      <form className="form" onSubmit={submit}>
        <label>
          Title
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Swimming lesson" autoFocus required />
        </label>
        <div className="form-row">
          <label>
            {repeat === 'none' ? 'Date' : 'Starts'}
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </label>
          <label>
            Time <span className="muted">(optional)</span>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </label>
        </div>
        <div className="form-row">
          <label>
            Repeat
            <select value={repeat} onChange={(e) => changeRepeat(e.target.value)}>
              {REPEAT_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Category
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {EVENT_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {pickDays && (
          <div className="form-field">
            <span className="form-label">On days</span>
            <div className="chip-row">
              {WEEKDAY_LABELS.map((label, dayIndex) => (
                <button
                  key={label}
                  type="button"
                  className={`chip${weekdays.includes(dayIndex) ? ' chip-active' : ''}`}
                  aria-pressed={weekdays.includes(dayIndex)}
                  onClick={() => toggleWeekday(dayIndex)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
        {repeat !== 'none' && (
          <label>
            Repeats until <span className="muted">(optional)</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </label>
        )}
        {kids.length > 0 && (
          <div className="form-field">
            <span className="form-label">Who's it for? <span className="muted">(none = whole family)</span></span>
            <ChildMultiSelect kids={kids} value={childIds} onChange={setChildIds} />
          </div>
        )}
        <label>
          Notes
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Bring goggles" />
        </label>
        <div className="form-actions">
          {onSkipDay && (
            <button type="button" className="danger-button" onClick={onSkipDay}>
              Delete this day
            </button>
          )}
          {onDelete && (
            <button type="button" className="danger-button" onClick={onDelete}>
              {event?.repeat !== 'none' ? 'Delete series' : 'Delete'}
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
