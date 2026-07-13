import { describe, expect, it } from 'vitest'
import {
  addDays,
  ageFromDob,
  monthGrid,
  parseDateKey,
  toDateKey,
  upcomingEvents,
} from './dateUtils.js'

describe('date keys', () => {
  it('round-trips through toDateKey/parseDateKey', () => {
    const key = '2026-07-13'
    expect(toDateKey(parseDateKey(key))).toBe(key)
  })

  it('pads months and days', () => {
    expect(toDateKey(new Date(2026, 0, 5))).toBe('2026-01-05')
  })

  it('addDays crosses month boundaries', () => {
    expect(addDays('2026-07-30', 3)).toBe('2026-08-02')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
  })
})

describe('monthGrid', () => {
  it('produces Monday-first full weeks covering the month', () => {
    const weeks = monthGrid(new Date(2026, 6, 1)) // July 2026
    expect(weeks.length).toBeGreaterThanOrEqual(4)
    for (const week of weeks) expect(week).toHaveLength(7)
    // 1 July 2026 is a Wednesday, so the grid starts Monday 29 June.
    expect(weeks[0][0].key).toBe('2026-06-29')
    expect(weeks[0][0].inMonth).toBe(false)
    expect(weeks[0][2].key).toBe('2026-07-01')
    expect(weeks[0][2].inMonth).toBe(true)
    // Last week contains 31 July.
    const allKeys = weeks.flat().map((c) => c.key)
    expect(allKeys).toContain('2026-07-31')
  })
})

describe('upcomingEvents', () => {
  const events = [
    { id: 'a', date: '2026-07-15', time: '14:00' },
    { id: 'b', date: '2026-07-15', time: '09:00' },
    { id: 'c', date: '2026-07-14', time: '' },
    { id: 'd', date: '2026-07-30', time: '' },
    { id: 'e', date: '2026-07-10', time: '' },
  ]

  it('filters to the window and sorts by date then time', () => {
    const result = upcomingEvents(events, '2026-07-13', 7)
    expect(result.map((e) => e.id)).toEqual(['c', 'b', 'a'])
  })

  it('includes the last day of the window', () => {
    const result = upcomingEvents(events, '2026-07-24', 7)
    expect(result.map((e) => e.id)).toEqual(['d'])
  })
})

describe('ageFromDob', () => {
  it('reports months under two years', () => {
    expect(ageFromDob('2026-01-13', '2026-07-13')).toBe('6 mo')
  })

  it('reports whole years after that', () => {
    expect(ageFromDob('2019-07-01', '2026-07-13')).toBe('7')
  })

  it('is null for unset or future dob', () => {
    expect(ageFromDob('', '2026-07-13')).toBeNull()
    expect(ageFromDob('2027-01-01', '2026-07-13')).toBeNull()
  })
})
