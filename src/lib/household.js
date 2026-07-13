import { supabase } from './supabase.js'

// Household sharing client. A "household" is identified by its owner's user
// id — the user whose `family_data` row and storage folder hold the shared
// hub. These wrap the tables + RPCs created by supabase/household.sql.
//
// Every call assumes that SQL has been applied. The caller (useHousehold)
// treats a thrown error — most commonly "relation does not exist" before the
// SQL is run — as "feature not enabled" and falls back to solo mode, so the
// app keeps working unchanged until the backend is set up.

// Resolve the caller's household. RLS scopes the select to their own
// household, so when they're solo this returns no rows and the owner is
// themselves.
export async function fetchHousehold(userId) {
  const { data, error } = await supabase
    .from('household_members')
    .select('member_id, owner_id, email, role')

  if (error) throw error

  const rows = data || []
  const mine = rows.find((row) => row.member_id === userId)
  const ownerId = mine ? mine.owner_id : userId

  const members = rows
    .filter((row) => row.owner_id === ownerId)
    .map((row) => ({
      memberId: row.member_id,
      email: row.email,
      role: row.role,
    }))
    // Owner first, then by email for a stable order.
    .sort((a, b) => {
      if (a.role !== b.role) return a.role === 'owner' ? -1 : 1
      return (a.email || '').localeCompare(b.email || '')
    })

  return {
    ownerId,
    role: mine?.role ?? 'owner',
    isShared: members.length > 1,
    members,
  }
}

export async function createInvite() {
  const { data, error } = await supabase.rpc('create_household_invite')
  if (error) throw error
  return data // the invite code
}

export async function joinHousehold(code) {
  const { data, error } = await supabase.rpc('join_household', {
    invite_code: code,
  })
  if (error) throw error
  return data // the household owner id
}

export async function leaveHousehold() {
  const { error } = await supabase.rpc('leave_household')
  if (error) throw error
}

export async function removeMember(memberId) {
  const { error } = await supabase.rpc('remove_household_member', {
    target: memberId,
  })
  if (error) throw error
}

export async function disbandHousehold() {
  const { error } = await supabase.rpc('disband_household')
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Invite link + share helpers
// ---------------------------------------------------------------------------
const JOIN_PARAM = 'join'
const JOIN_STORAGE_KEY = 'treehouse:pendingJoinCode'

// The app's own URL (origin + path, no query/hash), used as the invite link base.
export function appBaseUrl() {
  return window.location.origin + window.location.pathname
}

// A link that opens the app and prefills the join code for the recipient.
export function inviteLink(code) {
  return `${appBaseUrl()}?${JOIN_PARAM}=${encodeURIComponent(code)}`
}

// The full message we share: a friendly line, the link (which auto-fills the
// code), and the code spelled out as a fallback for anyone typing it by hand.
export function inviteMessage(code) {
  return [
    "Join our family hub so we share the kids' calendar, documents and photos.",
    '',
    `Open: ${inviteLink(code)}`,
    `Code: ${code}`,
    '',
    "Sign in with your own Google account, then it'll offer to join.",
  ].join('\n')
}

// On load, pull a ?join=CODE off the URL into sessionStorage (so it survives a
// sign-in redirect) and clean the address bar. Returns the pending code, if any.
export function captureJoinCodeFromUrl() {
  try {
    const params = new URLSearchParams(window.location.search)
    const code = params.get(JOIN_PARAM)

    if (code) {
      sessionStorage.setItem(JOIN_STORAGE_KEY, code.trim().toUpperCase())
      params.delete(JOIN_PARAM)
      const query = params.toString()
      const newUrl =
        window.location.pathname + (query ? `?${query}` : '') + window.location.hash
      window.history.replaceState({}, '', newUrl)
    }

    return sessionStorage.getItem(JOIN_STORAGE_KEY)
  } catch {
    return null
  }
}

export function clearPendingJoinCode() {
  try {
    sessionStorage.removeItem(JOIN_STORAGE_KEY)
  } catch {
    // sessionStorage unavailable — nothing to clear.
  }
}

// Turn a raw RPC/Postgres error into a short, friendly message for the UI.
export function friendlyHouseholdError(error) {
  const message = String(error?.message || '')
  if (/invalid_or_expired_code/.test(message)) {
    return "That code isn't valid or has expired. Ask for a fresh one."
  }
  if (/cannot_join_own_household/.test(message)) {
    return "That's your own household's code."
  }
  if (/not_authenticated/.test(message)) {
    return 'You need to be signed in.'
  }
  if (/relation .* does not exist|function .* does not exist/i.test(message)) {
    return "Household sharing isn't enabled on the server yet (run supabase/household.sql)."
  }
  return 'Something went wrong. Please try again.'
}
