// On-device alarm scheduling for the Nest native app (Capacitor).
//
// Web push proved unreliable on Android — Doze/battery optimisation silently
// drops normal-priority pushes, so a reminder set for 8:30 might never arrive.
// When Nest runs inside its native Android shell we sidestep the network
// entirely: we read the family's events and to-dos and hand each upcoming
// reminder to the OS as a real local notification (an on-device alarm), the
// same mechanism a clock app uses. These fire whether or not there's signal,
// and survive Doze.
//
// This module is a no-op in a normal browser (Capacitor.isNativePlatform() is
// false there) — the web build keeps using web push. All the date maths mirrors
// src/lib/reminders.js so the two agree on when a reminder is due.

import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { eventReminders, reminderLeadLabel } from './familyData.js'
import { localWallToUtcMs } from './reminders.js'
import { occurrencesInRange } from '../utils/recurrence.js'
import { toDateKey } from '../utils/dateUtils.js'

// How far ahead we pre-arm alarms, and the most we keep pending at once.
// Android caps how many notifications an app can schedule, and the family
// calendar's recurring events could otherwise run to hundreds. We re-sync
// every time Nest opens (and whenever the data changes), so a rolling window
// of the soonest reminders is always kept armed.
const HORIZON_DAYS = 60
const MAX_PENDING = 60
const TODO_HOUR = 9 // local hour a "to-do due today" alarm fires at

// A dedicated high-importance channel for reminders. Using our own channel
// means the reminder chime is bundled (res/raw/nest_chime.wav) AND the family
// can change it to any sound they like in Android settings (Settings → Apps →
// Nest → Notifications → Reminders → Sound). Note: Android freezes a channel's
// settings after it's first created, so to ship a *different* default sound
// later we'd bump the channel id.
const CHANNEL_ID = 'nest-reminders-v1'
const SOUND = 'nest_chime.wav'

export const isNativeApp = () => Capacitor.isNativePlatform()

let channelReady = false
async function ensureChannel() {
  if (!isNativeApp() || channelReady) return
  channelReady = true
  try {
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: 'Reminders',
      description: 'Event and to-do reminders',
      importance: 5, // high — makes a sound and pops a heads-up alert
      visibility: 1,
      sound: SOUND,
      vibration: true,
    })
  } catch (err) {
    channelReady = false
    console.error('Creating the reminders channel failed', err)
  }
}

// A stable positive 32-bit id for a reminder key, so re-scheduling the same
// reminder replaces it in place rather than stacking duplicates (FNV-1a).
function idFor(key) {
  let h = 2166136261
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h & 0x7fffffff) || 1
}

// The upcoming reminders to arm, soonest first, capped at MAX_PENDING. Each:
//   { id, key, title, body, at:Date }
export function upcomingReminders(data, { now = Date.now(), tz } = {}) {
  const zone = tz || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  const horizonMs = now + HORIZON_DAYS * 86400000
  const out = []

  const startKey = toDateKey(new Date(now))
  const endKey = toDateKey(new Date(horizonMs + 2 * 86400000))
  for (const occ of occurrencesInRange(data.events || [], startKey, endKey)) {
    if (!occ.time) continue
    const startMs = localWallToUtcMs(occ.date, occ.time, zone)
    for (const mins of eventReminders(occ)) {
      const fireMs = startMs - mins * 60000
      if (fireMs > now && fireMs <= horizonMs) {
        const key = `evt:${occ.id}:${occ.date}:${mins}`
        out.push({
          id: idFor(key),
          key,
          title: occ.title,
          body: `${occ.time} · ${reminderLeadLabel(mins)}`,
          at: new Date(fireMs),
        })
      }
    }
  }

  const hh = String(TODO_HOUR).padStart(2, '0')
  for (const todo of data.todos || []) {
    if (!todo.remind || todo.done || !todo.dueDate) continue
    const fireMs = localWallToUtcMs(todo.dueDate, `${hh}:00`, zone)
    if (fireMs > now && fireMs <= horizonMs) {
      const key = `todo:${todo.id}:${todo.dueDate}`
      out.push({ id: idFor(key), key, title: 'To-do due today', body: todo.title, at: new Date(fireMs) })
    }
  }

  out.sort((a, b) => a.at - b.at)
  return out.slice(0, MAX_PENDING)
}

// Ask for notification permission (and exact-alarm on Android 13+). Returns
// true when granted. Safe to call repeatedly — the OS only prompts once.
export async function ensureNativePermission() {
  if (!isNativeApp()) return false
  const current = await LocalNotifications.checkPermissions()
  if (current.display === 'granted') return true
  const asked = await LocalNotifications.requestPermissions()
  return asked.display === 'granted'
}

// Reconcile the OS's pending alarms with what the data now says: schedule the
// desired set (re-scheduling by id is idempotent) and cancel any previously
// armed Nest alarm that's no longer wanted (event moved, to-do ticked off).
export async function syncNativeReminders(data, opts = {}) {
  if (!isNativeApp()) return { scheduled: 0, cancelled: 0 }
  const granted = await ensureNativePermission()
  if (!granted) return { scheduled: 0, cancelled: 0, blocked: true }
  await ensureChannel()

  const desired = upcomingReminders(data, opts)
  const desiredIds = new Set(desired.map((r) => r.id))

  const { notifications: pending } = await LocalNotifications.getPending()
  const stale = (pending || []).filter((n) => !desiredIds.has(n.id))
  if (stale.length) {
    await LocalNotifications.cancel({ notifications: stale.map((n) => ({ id: n.id })) })
  }

  if (desired.length) {
    await LocalNotifications.schedule({
      notifications: desired.map((r) => ({
        id: r.id,
        title: r.title,
        body: r.body,
        schedule: { at: r.at, allowWhileIdle: true },
        channelId: CHANNEL_ID,
        sound: SOUND, // used on Android < 8; on 8+ the channel's sound wins
        smallIcon: 'ic_stat_nest',
        extra: { key: r.key },
      })),
    })
  }

  return { scheduled: desired.length, cancelled: stale.length }
}

// Tapping an alarm opens Nest. Registered once at startup.
let tapListenerAdded = false
export async function registerNativeTapHandler() {
  if (!isNativeApp() || tapListenerAdded) return
  tapListenerAdded = true
  await LocalNotifications.addListener('localNotificationActionPerformed', () => {
    // The shell loads the live app already; nothing more to do than bring it
    // to the foreground, which the OS does on tap.
  })
}
