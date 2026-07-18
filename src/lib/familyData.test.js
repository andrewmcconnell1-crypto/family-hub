import { describe, expect, it } from 'vitest'
import {
  emptyData,
  expiringDocuments,
  loadData,
  normalizeData,
  reorderTodo,
  reorderTodoToIndex,
  saveData,
} from './familyData.js'

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

describe('todos', () => {
  it('normalizes todos with defaults and boolean done', () => {
    const data = normalizeData({
      todos: [
        { id: 't1', title: 'Book dentist', done: 'yes' },
        { id: 't2', title: 'RSVP', done: true, dueDate: '2026-07-20' },
        { id: 't3' },
      ],
    })
    expect(data.todos.map((t) => t.id)).toEqual(['t1', 't2'])
    expect(data.todos[0]).toMatchObject({ done: false, doneAt: '', dueDate: '', notes: '' })
    expect(data.todos[1].done).toBe(true)
  })
})

describe('reorderTodoToIndex', () => {
  const todos = [
    { id: 'a', done: false },
    { id: 'b', done: true },
    { id: 'c', done: false },
    { id: 'd', done: false },
  ]

  it('places a todo at the target index among actives, leaving done items put', () => {
    // actives are [a, c, d]; move d to the front
    expect(reorderTodoToIndex(todos, 'd', 0).map((t) => t.id)).toEqual(['d', 'a', 'b', 'c'])
    // move a to the end
    expect(reorderTodoToIndex(todos, 'a', 2).map((t) => t.id)).toEqual(['b', 'c', 'd', 'a'])
  })

  it('clamps out-of-range targets and ignores unknown ids', () => {
    expect(reorderTodoToIndex(todos, 'a', 99).map((t) => t.id)).toEqual(['b', 'c', 'd', 'a'])
    expect(reorderTodoToIndex(todos, 'nope', 1)).toBe(todos)
  })
})

describe('reorderTodo', () => {
  const todos = [
    { id: 'a', done: false },
    { id: 'b', done: true },
    { id: 'c', done: false },
    { id: 'd', done: false },
  ]

  it('swaps with the nearest not-done neighbour, skipping done items', () => {
    expect(reorderTodo(todos, 'c', -1).map((t) => t.id)).toEqual(['c', 'b', 'a', 'd'])
    expect(reorderTodo(todos, 'c', 1).map((t) => t.id)).toEqual(['a', 'b', 'd', 'c'])
  })

  it('is a no-op at the boundaries or for unknown ids', () => {
    expect(reorderTodo(todos, 'a', -1)).toBe(todos)
    expect(reorderTodo(todos, 'd', 1)).toBe(todos)
    expect(reorderTodo(todos, 'nope', 1)).toBe(todos)
  })
})

describe('document links', () => {
  it('defaults documentIds and drops links to missing documents', () => {
    const data = normalizeData({
      documents: [{ id: 'd1', title: 'Invite', fileId: 'f1' }],
      events: [{ id: 'e1', title: 'Party', date: '2026-07-20', documentIds: ['d1', 'ghost'] }],
      todos: [{ id: 't1', title: 'RSVP', documentIds: 'junk' }],
    })
    expect(data.events[0].documentIds).toEqual(['d1'])
    expect(data.todos[0].documentIds).toEqual([])
  })
})

describe('expiringDocuments', () => {
  const docs = [
    { id: 'a', title: 'Passport', expiryDate: '2026-08-01' },
    { id: 'b', title: 'Rego', expiryDate: '2026-07-10' }, // already expired
    { id: 'c', title: 'Insurance', expiryDate: '2027-01-01' }, // far future
    { id: 'd', title: 'Letter', expiryDate: '' }, // no expiry
  ]

  it('returns expired + soon-to-expire docs, soonest first', () => {
    const out = expiringDocuments(docs, '2026-07-15', '2026-08-14')
    expect(out.map((d) => d.id)).toEqual(['b', 'a'])
  })

  it('defaults expiryDate to empty on normalize', () => {
    const data = normalizeData({ documents: [{ id: 'd1', title: 'X', fileId: 'f1' }] })
    expect(data.documents[0].expiryDate).toBe('')
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
