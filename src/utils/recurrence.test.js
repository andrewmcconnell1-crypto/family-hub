import { describe, expect, it } from 'vitest'
import {
  birthdayOccurrences,
  calendarOccurrences,
  occurrencesInRange,
  weekdayIndex,
} from './recurrence.js'

const base = {
  id: 'e1',
  title: 'Run',
  time: '',
  category: 'other',
  childIds: [],
  notes: '',
  weekdays: [],
  endDate: '',
  exceptions: [],
}

describe('weekdayIndex', () => {
  it('is Monday-first', () => {
    expect(weekdayIndex('2026-07-13')).toBe(0) // a Monday
    expect(weekdayIndex('2026-07-19')).toBe(6) // a Sunday
  })
})

describe('occurrencesInRange', () => {
  it('passes through one-off events inside the range only', () => {
    const events = [
      { ...base, date: '2026-07-15', repeat: 'none' },
      { ...base, id: 'e2', date: '2026-08-15', repeat: 'none' },
    ]
    const out = occurrencesInRange(events, '2026-07-01', '2026-07-31')
    expect(out.map((o) => o.id)).toEqual(['e1'])
  })

  it('expands a multi-day (spanning) one-off across each day it covers', () => {
    const events = [{ ...base, date: '2026-07-15', endDate: '2026-07-18', repeat: 'none' }]
    const out = occurrencesInRange(events, '2026-07-01', '2026-07-31')
    expect(out.map((o) => o.date)).toEqual(['2026-07-15', '2026-07-16', '2026-07-17', '2026-07-18'])
    expect(out[0].spanFirst).toBe(true)
    expect(out[3].spanLast).toBe(true)
    expect(out.every((o) => o.spanDays)).toBe(true)
  })

  it('clips a multi-day span to the query range', () => {
    const events = [{ ...base, date: '2026-07-15', endDate: '2026-07-25', repeat: 'none' }]
    const out = occurrencesInRange(events, '2026-07-17', '2026-07-19')
    expect(out.map((o) => o.date)).toEqual(['2026-07-17', '2026-07-18', '2026-07-19'])
  })

  it('treats an endDate on or before the start as a single day', () => {
    const events = [{ ...base, date: '2026-07-15', endDate: '2026-07-15', repeat: 'none' }]
    const out = occurrencesInRange(events, '2026-07-01', '2026-07-31')
    expect(out.map((o) => o.date)).toEqual(['2026-07-15'])
    expect(out[0].spanDays).toBe(false)
  })

  it('expands weekly repeats on multiple weekdays', () => {
    // Anchor Mon 13 Jul, runs Mon (0) and Wed (2).
    const events = [{ ...base, date: '2026-07-13', repeat: 'weekly', weekdays: [0, 2] }]
    const out = occurrencesInRange(events, '2026-07-13', '2026-07-26')
    expect(out.map((o) => o.date)).toEqual([
      '2026-07-13',
      '2026-07-15',
      '2026-07-20',
      '2026-07-22',
    ])
  })

  it('never emits occurrences before the anchor date', () => {
    const events = [{ ...base, date: '2026-07-15', repeat: 'weekly', weekdays: [0, 2] }]
    const out = occurrencesInRange(events, '2026-07-01', '2026-07-21')
    expect(out.map((o) => o.date)).toEqual(['2026-07-15', '2026-07-20'])
  })

  it('expands fortnightly repeats on the anchor week parity', () => {
    const events = [{ ...base, date: '2026-07-13', repeat: 'fortnightly' }]
    const out = occurrencesInRange(events, '2026-07-13', '2026-08-16')
    expect(out.map((o) => o.date)).toEqual(['2026-07-13', '2026-07-27', '2026-08-10'])
  })

  it('expands monthly repeats and skips short months', () => {
    const events = [{ ...base, date: '2026-01-31', repeat: 'monthly' }]
    const out = occurrencesInRange(events, '2026-01-01', '2026-04-30')
    expect(out.map((o) => o.date)).toEqual(['2026-01-31', '2026-03-31']) // no 31 Feb / Apr
  })

  it('expands yearly repeats', () => {
    const events = [{ ...base, date: '2025-12-25', repeat: 'yearly' }]
    const out = occurrencesInRange(events, '2026-12-01', '2026-12-31')
    expect(out.map((o) => o.date)).toEqual(['2026-12-25'])
  })

  it('honours endDate and exceptions', () => {
    const events = [
      {
        ...base,
        date: '2026-07-13',
        repeat: 'weekly',
        endDate: '2026-07-27',
        exceptions: ['2026-07-20'],
      },
    ]
    const out = occurrencesInRange(events, '2026-07-01', '2026-08-31')
    expect(out.map((o) => o.date)).toEqual(['2026-07-13', '2026-07-27'])
  })
})

describe('birthdayOccurrences', () => {
  const kids = [{ id: 'c1', name: 'Ada', dob: '2020-07-20', colorId: 'sky' }]

  it('synthesises a birthday with the age turned', () => {
    const out = birthdayOccurrences(kids, '2026-07-01', '2026-07-31')
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({
      date: '2026-07-20',
      title: 'Ada turns 6 🎂',
      category: 'birthday',
      childIds: ['c1'],
      isBirthday: true,
    })
  })

  it('is empty outside the birthday window or without a dob', () => {
    expect(birthdayOccurrences(kids, '2026-08-01', '2026-08-31')).toEqual([])
    expect(birthdayOccurrences([{ id: 'c2', name: 'Sam', dob: '' }], '2026-01-01', '2026-12-31')).toEqual([])
  })
})

describe('calendarOccurrences', () => {
  it('merges events and birthdays sorted by date, timed before all-day', () => {
    const data = {
      events: [
        { ...base, id: 'e1', title: 'Dentist', date: '2026-07-20', time: '15:00', repeat: 'none' },
        { ...base, id: 'e2', title: 'School fair', date: '2026-07-19', repeat: 'none' },
      ],
      children: [{ id: 'c1', name: 'Ada', dob: '2020-07-20' }],
    }
    const out = calendarOccurrences(data, '2026-07-19', '2026-07-21')
    expect(out.map((o) => o.title)).toEqual(['School fair', 'Dentist', 'Ada turns 6 🎂'])
  })
})
