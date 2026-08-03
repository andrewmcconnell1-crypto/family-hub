import { describe, expect, it } from 'vitest'
import { collectDueReminders, localWallToUtcMs } from './reminders.js'

// Fire time for an event at 09:00 UTC with a 30-minute lead = 08:30 UTC.
const at = (dateKey, time) => localWallToUtcMs(dateKey, time, 'UTC')

describe('localWallToUtcMs', () => {
  it('treats the wall time as UTC when tz is UTC', () => {
    expect(localWallToUtcMs('2026-07-20', '09:00', 'UTC')).toBe(Date.UTC(2026, 6, 20, 9, 0))
  })

  it('applies a fixed offset zone', () => {
    // Brisbane is UTC+10 with no DST: 09:00 local = 23:00 UTC the day before.
    expect(localWallToUtcMs('2026-07-20', '09:00', 'Australia/Brisbane')).toBe(
      Date.UTC(2026, 6, 19, 23, 0),
    )
  })
})

describe('collectDueReminders — events', () => {
  const data = {
    events: [
      { id: 'e1', title: 'Dentist', date: '2026-07-20', time: '09:00', reminder: 30 },
      { id: 'e2', title: 'All-day thing', date: '2026-07-20', time: '', reminder: 30 },
      { id: 'e3', title: 'No reminder', date: '2026-07-20', time: '11:00', reminder: null },
    ],
    todos: [],
  }

  it('fires an event reminder inside the window', () => {
    const out = collectDueReminders(data, {
      tz: 'UTC',
      windowStartMs: at('2026-07-20', '08:20'),
      windowEndMs: at('2026-07-20', '08:35'),
    })
    expect(out).toEqual([
      { key: 'evt:e1:2026-07-20:30', title: 'Dentist', body: '09:00 · in 30 minutes' },
    ])
  })

  it('fires each of an event with multiple reminders', () => {
    const multi = {
      events: [
        { id: 'm1', title: 'Flight', date: '2026-07-20', time: '10:00', reminders: [60, 1440] },
      ],
      todos: [],
    }
    // The "1 day before" reminder (fires 2026-07-19 10:00).
    const dayBefore = collectDueReminders(multi, {
      tz: 'UTC',
      windowStartMs: at('2026-07-19', '09:59'),
      windowEndMs: at('2026-07-19', '10:01'),
    })
    expect(dayBefore).toEqual([
      { key: 'evt:m1:2026-07-20:1440', title: 'Flight', body: '10:00 · tomorrow' },
    ])
    // The "1 hour before" reminder (fires 2026-07-20 09:00).
    const hourBefore = collectDueReminders(multi, {
      tz: 'UTC',
      windowStartMs: at('2026-07-20', '08:59'),
      windowEndMs: at('2026-07-20', '09:01'),
    })
    expect(hourBefore).toEqual([
      { key: 'evt:m1:2026-07-20:60', title: 'Flight', body: '10:00 · in 1 hour' },
    ])
  })

  it('is exclusive at the window start and inclusive at the end', () => {
    const fire = at('2026-07-20', '08:30')
    expect(collectDueReminders(data, { tz: 'UTC', windowStartMs: fire, windowEndMs: fire + 1 })).toEqual([])
    expect(
      collectDueReminders(data, { tz: 'UTC', windowStartMs: fire - 1, windowEndMs: fire }),
    ).toHaveLength(1)
  })

  it('ignores all-day events and events without a reminder', () => {
    const out = collectDueReminders(data, {
      tz: 'UTC',
      windowStartMs: at('2026-07-20', '00:00'),
      windowEndMs: at('2026-07-20', '23:59'),
    })
    // Only e1 (timed + reminder) fires; e2 all-day and e3 null are skipped.
    expect(out.map((r) => r.title)).toEqual(['Dentist'])
  })

  it('fires a reminder for a recurring occurrence', () => {
    const weekly = {
      events: [
        { id: 'w1', title: 'Standup', date: '2026-07-06', time: '10:00', reminder: 10, repeat: 'weekly' },
      ],
      todos: [],
    }
    // 2026-07-20 is a Monday like the 6th; reminder fires at 09:50.
    const out = collectDueReminders(weekly, {
      tz: 'UTC',
      windowStartMs: at('2026-07-20', '09:45'),
      windowEndMs: at('2026-07-20', '09:55'),
    })
    expect(out).toEqual([
      { key: 'evt:w1:2026-07-20:10', title: 'Standup', body: '10:00 · in 10 minutes' },
    ])
  })
})

describe('collectDueReminders — to-dos', () => {
  const data = {
    events: [],
    todos: [
      { id: 't1', title: 'RSVP', dueDate: '2026-07-20', remind: true, done: false },
      { id: 't2', title: 'No remind', dueDate: '2026-07-20', remind: false, done: false },
      { id: 't3', title: 'Done', dueDate: '2026-07-20', remind: true, done: true },
    ],
  }

  it('fires at the configured to-do hour on the due date', () => {
    const out = collectDueReminders(data, {
      tz: 'UTC',
      windowStartMs: at('2026-07-20', '08:55'),
      windowEndMs: at('2026-07-20', '09:05'),
      todoHour: 9,
    })
    expect(out).toEqual([{ key: 'todo:t1:2026-07-20', title: 'To-do due today', body: 'RSVP' }])
  })

  it('skips to-dos that are done or have reminders off', () => {
    const out = collectDueReminders(data, {
      tz: 'UTC',
      windowStartMs: at('2026-07-20', '00:00'),
      windowEndMs: at('2026-07-21', '00:00'),
      todoHour: 9,
    })
    expect(out.map((r) => r.body)).toEqual(['RSVP'])
  })
})
