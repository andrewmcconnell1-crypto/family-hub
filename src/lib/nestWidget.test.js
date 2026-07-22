import { describe, expect, it } from 'vitest'
import { todaySummary } from './nestWidget.js'

// Local noon on 2026-07-22 so toDateKey resolves to that day regardless of tz.
const NOON = new Date(2026, 6, 22, 12, 0, 0)

describe('todaySummary', () => {
  it('lists today’s events (friendly times) then to-dos due today', () => {
    const data = {
      events: [
        { id: 'e1', title: 'Dentist', date: '2026-07-22', time: '09:00' },
        { id: 'e2', title: 'Tomorrow', date: '2026-07-23', time: '10:00' },
      ],
      todos: [
        { id: 't1', title: 'Pay rent', dueDate: '2026-07-22' },
        { id: 't2', title: 'Done', dueDate: '2026-07-22', done: true },
        { id: 't3', title: 'Later', dueDate: '2026-07-25' },
      ],
      children: [],
    }
    const out = todaySummary(data, NOON)
    expect(out.items).toEqual([
      { time: '9am', text: 'Dentist' },
      { time: '', text: 'Pay rent' },
    ])
    expect(out.date).toContain('22')
  })

  it('includes a birthday occurring today', () => {
    const data = {
      events: [],
      todos: [],
      children: [{ id: 'c1', name: 'Mia', dob: '2020-07-22' }],
    }
    const out = todaySummary(data, NOON)
    expect(out.items).toHaveLength(1)
    expect(out.items[0].text).toContain('Mia turns 6')
  })

  it('returns an empty list when nothing is on', () => {
    const out = todaySummary({ events: [], todos: [], children: [] }, NOON)
    expect(out.items).toEqual([])
  })
})
