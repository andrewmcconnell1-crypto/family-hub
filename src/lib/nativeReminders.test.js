import { describe, expect, it } from 'vitest'
import { upcomingReminders } from './nativeReminders.js'

// Fixed "now" so the horizon window is deterministic: 2026-07-20 00:00 UTC.
const NOW = Date.UTC(2026, 6, 20, 0, 0)
const args = { now: NOW, tz: 'UTC' }

describe('upcomingReminders — events', () => {
  it('arms an event reminder at its fire time (start minus lead)', () => {
    const data = {
      events: [{ id: 'e1', title: 'Dentist', date: '2026-07-20', time: '09:00', reminder: 30 }],
      todos: [],
    }
    const out = upcomingReminders(data, args)
    expect(out).toHaveLength(1)
    expect(out[0].key).toBe('evt:e1:2026-07-20:30')
    expect(out[0].title).toBe('Dentist')
    expect(out[0].body).toBe('09:00 · in 30 minutes')
    expect(out[0].at.getTime()).toBe(Date.UTC(2026, 6, 20, 8, 30))
  })

  it('ignores events with no time or no reminder', () => {
    const data = {
      events: [
        { id: 'e2', title: 'All day', date: '2026-07-21', time: '', reminder: 30 },
        { id: 'e3', title: 'No reminder', date: '2026-07-21', time: '11:00', reminder: null },
      ],
      todos: [],
    }
    expect(upcomingReminders(data, args)).toEqual([])
  })

  it('skips reminders whose fire time has already passed', () => {
    const data = {
      events: [{ id: 'e4', title: 'Earlier today', date: '2026-07-20', time: '00:10', reminder: 30 }],
      todos: [],
    }
    // Fire time is 2026-07-19 23:40 UTC, before NOW.
    expect(upcomingReminders(data, args)).toEqual([])
  })

  it('honours a "0 minutes" (at start) reminder', () => {
    const data = {
      events: [{ id: 'e5', title: 'Standup', date: '2026-07-20', time: '09:00', reminder: 0 }],
      todos: [],
    }
    const out = upcomingReminders(data, args)
    expect(out).toHaveLength(1)
    expect(out[0].at.getTime()).toBe(Date.UTC(2026, 6, 20, 9, 0))
  })

  it('expands a recurring event across the horizon', () => {
    const data = {
      events: [
        { id: 'r1', title: 'Bins', date: '2026-07-20', time: '07:00', reminder: 0, repeat: 'weekly' },
      ],
      todos: [],
    }
    const out = upcomingReminders(data, args)
    // At least the next several weekly occurrences within 60 days.
    expect(out.length).toBeGreaterThanOrEqual(4)
    expect(out.every((r) => r.key.startsWith('evt:r1:'))).toBe(true)
    // Sorted soonest-first.
    for (let i = 1; i < out.length; i++) expect(out[i].at >= out[i - 1].at).toBe(true)
  })
})

describe('upcomingReminders — to-dos', () => {
  it('arms a to-do reminder at 09:00 local on its due date', () => {
    const data = {
      events: [],
      todos: [{ id: 't1', title: 'Pay rent', dueDate: '2026-07-25', remind: true }],
    }
    const out = upcomingReminders(data, args)
    expect(out).toHaveLength(1)
    expect(out[0].key).toBe('todo:t1:2026-07-25')
    expect(out[0].title).toBe('To-do due today')
    expect(out[0].body).toBe('Pay rent')
    expect(out[0].at.getTime()).toBe(Date.UTC(2026, 6, 25, 9, 0))
  })

  it('ignores done to-dos, and those without a reminder or due date', () => {
    const data = {
      events: [],
      todos: [
        { id: 't2', title: 'Done', dueDate: '2026-07-25', remind: true, done: true },
        { id: 't3', title: 'No remind', dueDate: '2026-07-25', remind: false },
        { id: 't4', title: 'No date', remind: true },
      ],
    }
    expect(upcomingReminders(data, args)).toEqual([])
  })
})

describe('upcomingReminders — ids', () => {
  it('gives a stable positive integer id for the same key', () => {
    const data = {
      events: [{ id: 'e1', title: 'Dentist', date: '2026-07-20', time: '09:00', reminder: 30 }],
      todos: [],
    }
    const a = upcomingReminders(data, args)[0].id
    const b = upcomingReminders(data, args)[0].id
    expect(a).toBe(b)
    expect(Number.isInteger(a)).toBe(true)
    expect(a).toBeGreaterThan(0)
  })
})
