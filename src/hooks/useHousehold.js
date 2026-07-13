import { useCallback, useEffect, useState } from 'react'
import { isSupabaseConfigured } from '../lib/supabase.js'
import { fetchHousehold } from '../lib/household.js'

function soloState(userId, { available }) {
  return {
    ownerId: userId,
    role: 'owner',
    isShared: false,
    members: [],
    available,
    loading: false,
  }
}

// Resolves the signed-in user's household: which data row (and storage
// folder) to read/write — the household owner's id — and who's in it. A solo
// user, and any setup where the household SQL hasn't been applied yet, owns
// their own data and behaves exactly as before. `available` is false when the
// backend SQL is missing, so the UI can explain the one-time setup instead of
// showing a broken feature.
export function useHousehold(user) {
  const userId = user?.id ?? null

  const [state, setState] = useState({
    ownerId: userId,
    role: 'owner',
    isShared: false,
    members: [],
    available: true,
    loading: Boolean(userId) && isSupabaseConfigured,
  })
  // Bumped by refresh() to re-run the resolve effect after a mutation.
  const [reloadToken, setReloadToken] = useState(0)

  const refresh = useCallback(() => setReloadToken((token) => token + 1), [])

  // All state updates happen inside the async IIFE (after an await, or guarded
  // by `active`) so nothing writes state synchronously in the effect body.
  useEffect(() => {
    let active = true

    ;(async () => {
      if (!isSupabaseConfigured || !userId) {
        if (active) setState(soloState(userId, { available: false }))
        return
      }

      try {
        const household = await fetchHousehold(userId)
        if (active) setState({ ...household, available: true, loading: false })
      } catch {
        // Tables/RPCs not present (SQL not run) or a transient error — fall
        // back to solo so the app keeps working.
        if (active) setState(soloState(userId, { available: false }))
      }
    })()

    return () => {
      active = false
    }
  }, [userId, reloadToken])

  return { ...state, currentUserId: userId, refresh }
}
