// Web-push reminders: subscribe this device and record the subscription in
// Supabase so the send-reminders edge function knows where to deliver the
// morning digest. See supabase/reminders-setup.md for the server side.

import { supabase } from './supabase.js'

// The VAPID *public* key — safe to ship in the client. It must match the
// VAPID_KEYS secret configured on the send-reminders edge function; rotate
// both together with scripts/generate-vapid-keys.mjs.
export const PUSH_PUBLIC_KEY =
  'BLpr4kliqGRkZUvglZ0Eaoc-YrpBTZAf1P5apW8CLNyRBsXjZLtIZGDl1tWrdjh_VA6Dd6JPTKpNwunH2tKvYvo'

const isIos = () => /iP(hone|ad|od)/.test(navigator.userAgent)
const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true

// Why reminders can't be offered right now, or null when they can.
export function pushBlocker() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    // iOS Safari only exposes push to apps added to the Home Screen.
    if (isIos() && !isStandalone()) return 'ios-install'
    return 'unsupported'
  }
  if (Notification.permission === 'denied') return 'denied'
  return null
}

function urlBase64ToUint8Array(base64) {
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob(padded.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (ch) => ch.charCodeAt(0))
}

async function swRegistration() {
  const existing = await navigator.serviceWorker.getRegistration()
  if (existing) return existing
  // Dev/preview never registered the worker — do it on demand.
  return navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`)
}

export async function currentPushSubscription() {
  if (pushBlocker()) return null
  const registration = await navigator.serviceWorker.getRegistration()
  if (!registration) return null
  return registration.pushManager.getSubscription()
}

export async function enablePushReminders(userId) {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('permission-denied')
  const registration = await swRegistration()
  await navigator.serviceWorker.ready
  const subscription =
    (await registration.pushManager.getSubscription()) ||
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(PUSH_PUBLIC_KEY),
    }))
  const { error } = await supabase.from('push_subscriptions').upsert(
    { user_id: userId, endpoint: subscription.endpoint, subscription: subscription.toJSON() },
    { onConflict: 'endpoint' },
  )
  if (error) throw error
  return subscription
}

export async function disablePushReminders() {
  const subscription = await currentPushSubscription()
  if (!subscription) return
  await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint)
  await subscription.unsubscribe()
}

// True when the error means "run supabase/reminders.sql first".
export function isMissingTableError(error) {
  return error?.code === '42P01' || error?.code === 'PGRST205'
}
