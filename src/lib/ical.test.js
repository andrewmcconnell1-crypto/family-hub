import { describe, expect, it } from 'vitest'
import { expandIcs, parseIcsDate } from './ical.js'

const wrap = (body) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${body}\r\nEND:VCALENDAR\r\n`

describe('parseIcsDate', () => {
  it('parses all-day dates', () => {
    expect(parseIcsDate('20260720')).toEqual({ dateKey: '2026-07-20', time: '' })
  })

  it('parses floating date-times as local wall time', () => {
    expect(parseIcsDate('20260720T093000')).toEqual({ dateKey: '2026-07-20', time: '09:30' })
  })

  it('converts UTC date-times to device time', () => {
    const local = new Date(Date.UTC(2026, 6, 20, 9, 30))
    const hh = String(local.getHours()).padStart(2, '0')
    const mm = String(local.getMinutes()).padStart(2, '0')
    expect(parseIcsDate('20260720T093000Z')).toMatchObject({ time: `${hh}:${mm}` })
  })

  it('treats unknown TZIDs as local wall time', () => {
    expect(parseIcsDate('20260720T093000', { TZID: 'Nonsense Standard Time' })).toEqual({
      dateKey: '2026-07-20',
      time: '09:30',
    })
  })
})

describe('expandIcs — single events', () => {
  it('expands a simple event with escaped text and folded lines', () => {
    const ics = wrap(
      'BEGIN:VEVENT\r\nUID:one@x\r\nSUMMARY:Party\\, at Grandma\r\n s\r\nDTSTART:20260720T140000\r\nEND:VEVENT',
    )
    const out = expandIcs(ics, '2026-07-01', '2026-07-31')
    expect(out).toEqual([
      { id: 'one@x-2026-07-20', title: 'Party, at Grandmas', date: '2026-07-20', time: '14:00', notes: '' },
    ])
  })

  it('spans multi-day all-day events (DTEND exclusive) and clips to the window', () => {
    const ics = wrap(
      'BEGIN:VEVENT\r\nUID:hols@x\r\nSUMMARY:Holidays\r\nDTSTART;VALUE=DATE:20260720\r\nDTEND;VALUE=DATE:20260723\r\nEND:VEVENT',
    )
    const out = expandIcs(ics, '2026-07-21', '2026-07-31')
    expect(out.map((o) => o.date)).toEqual(['2026-07-21', '2026-07-22'])
  })

  it('skips cancelled events and events outside the window', () => {
    const ics = wrap(
      'BEGIN:VEVENT\r\nUID:c@x\r\nSUMMARY:Gone\r\nSTATUS:CANCELLED\r\nDTSTART:20260720T100000\r\nEND:VEVENT\r\n' +
        'BEGIN:VEVENT\r\nUID:d@x\r\nSUMMARY:Early\r\nDTSTART;VALUE=DATE:20260601\r\nEND:VEVENT',
    )
    expect(expandIcs(ics, '2026-07-01', '2026-07-31')).toEqual([])
  })
})

describe('expandIcs — recurrence', () => {
  it('expands weekly BYDAY rules within the window', () => {
    // Mondays and Wednesdays from Mon 6 July.
    const ics = wrap(
      'BEGIN:VEVENT\r\nUID:run@x\r\nSUMMARY:Run\r\nDTSTART:20260706T063000\r\nRRULE:FREQ=WEEKLY;BYDAY=MO,WE\r\nEND:VEVENT',
    )
    const out = expandIcs(ics, '2026-07-20', '2026-07-26')
    expect(out.map((o) => o.date)).toEqual(['2026-07-20', '2026-07-22'])
    expect(out[0].time).toBe('06:30')
  })

  it('honours INTERVAL=2 (fortnightly) week parity', () => {
    const ics = wrap(
      'BEGIN:VEVENT\r\nUID:pay@x\r\nSUMMARY:Payday\r\nDTSTART;VALUE=DATE:20260706\r\nRRULE:FREQ=WEEKLY;INTERVAL=2\r\nEND:VEVENT',
    )
    const out = expandIcs(ics, '2026-07-06', '2026-08-03')
    expect(out.map((o) => o.date)).toEqual(['2026-07-06', '2026-07-20', '2026-08-03'])
  })

  it('honours COUNT even when the window starts later', () => {
    const ics = wrap(
      'BEGIN:VEVENT\r\nUID:cls@x\r\nSUMMARY:Class\r\nDTSTART;VALUE=DATE:20260701\r\nRRULE:FREQ=DAILY;COUNT=5\r\nEND:VEVENT',
    )
    // Only 1-5 July exist; a window starting on the 4th sees just two.
    const out = expandIcs(ics, '2026-07-04', '2026-07-31')
    expect(out.map((o) => o.date)).toEqual(['2026-07-04', '2026-07-05'])
  })

  it('stops at UNTIL and skips EXDATEs', () => {
    const ics = wrap(
      'BEGIN:VEVENT\r\nUID:u@x\r\nSUMMARY:Standup\r\nDTSTART;VALUE=DATE:20260701\r\n' +
        'RRULE:FREQ=DAILY;UNTIL=20260705\r\nEXDATE;VALUE=DATE:20260703\r\nEND:VEVENT',
    )
    const out = expandIcs(ics, '2026-07-01', '2026-07-31')
    expect(out.map((o) => o.date)).toEqual(['2026-07-01', '2026-07-02', '2026-07-04', '2026-07-05'])
  })

  it('supports monthly ordinal BYDAY (2nd Tuesday)', () => {
    const ics = wrap(
      'BEGIN:VEVENT\r\nUID:m@x\r\nSUMMARY:Book club\r\nDTSTART;VALUE=DATE:20260714\r\nRRULE:FREQ=MONTHLY;BYDAY=2TU\r\nEND:VEVENT',
    )
    const out = expandIcs(ics, '2026-07-01', '2026-09-30')
    expect(out.map((o) => o.date)).toEqual(['2026-07-14', '2026-08-11', '2026-09-08'])
  })

  it('replaces overridden occurrences via RECURRENCE-ID', () => {
    const ics = wrap(
      'BEGIN:VEVENT\r\nUID:s@x\r\nSUMMARY:Swim\r\nDTSTART:20260706T150000\r\nRRULE:FREQ=WEEKLY\r\nEND:VEVENT\r\n' +
        'BEGIN:VEVENT\r\nUID:s@x\r\nSUMMARY:Swim (moved)\r\nDTSTART:20260714T160000\r\n' +
        'RECURRENCE-ID:20260713T150000\r\nEND:VEVENT',
    )
    const out = expandIcs(ics, '2026-07-06', '2026-07-20')
    expect(out.map((o) => `${o.date} ${o.title}`)).toEqual([
      '2026-07-06 Swim',
      '2026-07-20 Swim',
      '2026-07-14 Swim (moved)',
    ])
  })
})
