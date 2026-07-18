// Load / save / normalise the app's data. Storage is injectable so the pure
// parts can be tested without a browser.
//
// Shape (all items may be tagged with zero or more family members via
// childIds; an empty list means "whole family"):
//   children:  [{ id, name, dob, colorId }]
//
// Naming note: `children` / `childIds` are the original storage keys but hold
// ALL family members (adults included). The keys are kept for backwards
// compatibility with data already saved locally and in the cloud — renaming
// them would need a two-way migration for little gain.
//   events:    [{ id, title, date, time, category, childIds, notes }]
//   documents: [{ id, title, category, childIds, notes,
//                 fileId, fileName, fileType, size, addedAt }]
//   photos:    [{ id, caption, childIds, fileId, fileType, addedAt }]
// Files themselves live in IndexedDB (see lib/fileStore.js), keyed by fileId.

const STORAGE_KEY = 'treehouse:data:v1'

export const CHILD_COLORS = [
  { id: 'meadow', value: '#4c9a63' },
  { id: 'sky', value: '#3f7fc2' },
  { id: 'plum', value: '#8e5aa8' },
  { id: 'sunset', value: '#d9772f' },
  { id: 'berry', value: '#c04f6e' },
  { id: 'sand', value: '#a08036' },
]

export function childColor(child) {
  const found = CHILD_COLORS.find((c) => c.id === child?.colorId)
  return (found || CHILD_COLORS[0]).value
}

// Does this item match a child filter ('all' or a child id)?
export function matchesChild(item, filter) {
  if (filter === 'all') return true
  return item.childIds.includes(filter)
}

// Documents already expired or expiring within the horizon, soonest first.
export function expiringDocuments(documents, fromKey, horizonKey) {
  return documents
    .filter((doc) => doc.expiryDate && doc.expiryDate <= horizonKey)
    .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate))
}

export const EVENT_CATEGORIES = [
  { id: 'school', label: 'School' },
  { id: 'medical', label: 'Medical' },
  { id: 'activity', label: 'Activity' },
  { id: 'birthday', label: 'Birthday' },
  { id: 'other', label: 'Other' },
]

export const DOC_CATEGORIES = [
  { id: 'medical', label: 'Medical' },
  { id: 'school', label: 'School' },
  { id: 'identity', label: 'Identity' },
  { id: 'activities', label: 'Activities' },
  { id: 'other', label: 'Other' },
]

export function emptyData() {
  return { children: [], todos: [], events: [], documents: [], photos: [] }
}

// The todos array's order IS the priority order (actives only; done items are
// displayed separately). Move a todo one step up/down past its nearest
// not-done neighbour, returning a new array (or the same one at a boundary).
export function reorderTodo(todos, id, delta) {
  const index = todos.findIndex((t) => t.id === id)
  if (index === -1) return todos
  let neighbour = index + delta
  while (neighbour >= 0 && neighbour < todos.length && todos[neighbour].done) {
    neighbour += delta
  }
  if (neighbour < 0 || neighbour >= todos.length) return todos
  const next = [...todos]
  ;[next[index], next[neighbour]] = [next[neighbour], next[index]]
  return next
}

const isNonEmptyString = (v) => typeof v === 'string' && v.length > 0

function normalizeList(list, required, defaults) {
  if (!Array.isArray(list)) return []
  return list
    .filter((item) => item && typeof item === 'object' && required.every((k) => isNonEmptyString(item[k])))
    .map((item) => ({
      ...defaults,
      ...item,
      childIds: Array.isArray(item.childIds) ? item.childIds.filter(isNonEmptyString) : [],
    }))
}

// Coerce anything (old versions, hand-edited JSON, junk) into the shape above.
export function normalizeData(raw) {
  if (!raw || typeof raw !== 'object') return emptyData()
  const children = normalizeList(raw.children, ['id', 'name'], {
    dob: '',
    colorId: 'meadow',
    avatarFileId: '',
  })
  const childIdSet = new Set(children.map((c) => c.id))
  const data = {
    children,
    todos: normalizeList(raw.todos, ['id', 'title'], {
      done: false,
      doneAt: '',
      dueDate: '',
      notes: '',
      documentIds: [],
    }).map((todo) => ({
      ...todo,
      done: todo.done === true,
      documentIds: Array.isArray(todo.documentIds) ? todo.documentIds.filter(isNonEmptyString) : [],
    })),
    events: normalizeList(raw.events, ['id', 'title', 'date'], {
      time: '',
      category: 'other',
      notes: '',
      repeat: 'none',
      weekdays: [],
      endDate: '',
      exceptions: [],
    }).map((event) => ({
      ...event,
      weekdays: Array.isArray(event.weekdays)
        ? event.weekdays.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
        : [],
      exceptions: Array.isArray(event.exceptions)
        ? event.exceptions.filter(isNonEmptyString)
        : [],
      documentIds: Array.isArray(event.documentIds)
        ? event.documentIds.filter(isNonEmptyString)
        : [],
    })),
    documents: normalizeList(raw.documents, ['id', 'title', 'fileId'], {
      category: 'other',
      notes: '',
      fileName: '',
      fileType: '',
      size: 0,
      addedAt: '',
      expiryDate: '',
    }),
    photos: normalizeList(raw.photos, ['id', 'fileId'], {
      caption: '',
      fileType: '',
      addedAt: '',
    }),
  }
  // Drop tags pointing at children that no longer exist.
  for (const listName of ['todos', 'events', 'documents', 'photos']) {
    for (const item of data[listName]) {
      item.childIds = item.childIds.filter((id) => childIdSet.has(id))
    }
  }
  // Same for links to documents that no longer exist.
  const docIdSet = new Set(data.documents.map((doc) => doc.id))
  for (const listName of ['todos', 'events']) {
    for (const item of data[listName]) {
      item.documentIds = item.documentIds.filter((id) => docIdSet.has(id))
    }
  }
  return data
}

export function loadData(storage = window.localStorage) {
  try {
    const raw = storage.getItem(STORAGE_KEY)
    return normalizeData(raw ? JSON.parse(raw) : null)
  } catch {
    return emptyData()
  }
}

export function saveData(data, storage = window.localStorage) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // Best effort — quota errors etc. shouldn't crash the app.
  }
}

export function hasContent(data) {
  return (
    data.children.length > 0 ||
    data.todos.length > 0 ||
    data.events.length > 0 ||
    data.documents.length > 0 ||
    data.photos.length > 0
  )
}

// ---------------------------------------------------------------------------
// Cloud persistence (Supabase): one row of JSON per user, protected by RLS.
// See supabase/setup.sql. File blobs go through lib/fileStore.js instead.
// ---------------------------------------------------------------------------

const TABLE = 'family_data'

export async function fetchCloudData(supabase, userId) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('data')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  return data ? data.data : null
}

export async function saveCloudData(supabase, userId, data) {
  const updatedAt = new Date().toISOString()

  const { error } = await supabase
    .from(TABLE)
    .upsert({ user_id: userId, data, updated_at: updatedAt }, { onConflict: 'user_id' })

  if (error) throw error
  return updatedAt
}
