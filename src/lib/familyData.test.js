import { describe, expect, it } from 'vitest'
import { emptyData, loadData, normalizeData, saveData } from './familyData.js'

describe('normalizeData', () => {
  it('returns empty data for junk input', () => {
    expect(normalizeData(null)).toEqual(emptyData())
    expect(normalizeData('nope')).toEqual(emptyData())
    expect(normalizeData(42)).toEqual(emptyData())
  })

  it('drops entries missing required fields', () => {
    const data = normalizeData({
      children: [{ id: 'c1', name: 'Ada' }, { id: 'c2' }, null],
      events: [{ id: 'e1', title: 'Swim', date: '2026-07-14' }, { id: 'e2', title: 'No date' }],
      documents: [{ id: 'd1', title: 'Passport', fileId: 'f1' }, { id: 'd2', title: 'No file' }],
      photos: [{ id: 'p1', fileId: 'f2' }, { id: 'p2' }],
    })
    expect(data.children.map((c) => c.id)).toEqual(['c1'])
    expect(data.events.map((e) => e.id)).toEqual(['e1'])
    expect(data.documents.map((d) => d.id)).toEqual(['d1'])
    expect(data.photos.map((p) => p.id)).toEqual(['p1'])
  })

  it('fills defaults and coerces childIds', () => {
    const data = normalizeData({
      children: [{ id: 'c1', name: 'Ada' }],
      events: [{ id: 'e1', title: 'Swim', date: '2026-07-14', childIds: 'not-a-list' }],
    })
    expect(data.children[0]).toMatchObject({ dob: '', colorId: 'meadow', childIds: [] })
    expect(data.events[0]).toMatchObject({ time: '', category: 'other', notes: '', childIds: [] })
  })

  it('strips tags for children that no longer exist', () => {
    const data = normalizeData({
      children: [{ id: 'c1', name: 'Ada' }],
      events: [{ id: 'e1', title: 'Swim', date: '2026-07-14', childIds: ['c1', 'ghost'] }],
    })
    expect(data.events[0].childIds).toEqual(['c1'])
  })
})

describe('loadData / saveData', () => {
  const memoryStorage = () => {
    const map = new Map()
    return {
      getItem: (k) => (map.has(k) ? map.get(k) : null),
      setItem: (k, v) => map.set(k, v),
    }
  }

  it('round-trips data through storage', () => {
    const storage = memoryStorage()
    const data = normalizeData({ children: [{ id: 'c1', name: 'Ada' }] })
    saveData(data, storage)
    expect(loadData(storage)).toEqual(data)
  })

  it('returns empty data for a fresh or corrupted store', () => {
    expect(loadData(memoryStorage())).toEqual(emptyData())
    const corrupted = memoryStorage()
    corrupted.setItem('treehouse:data:v1', '{not json')
    expect(loadData(corrupted)).toEqual(emptyData())
  })
})
