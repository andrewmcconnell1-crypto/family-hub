import { useEffect, useState } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabase.js'

// Tracks the signed-in user (or null) and exposes sign-in / sign-out.
// When Supabase isn't configured it stays in a "no auth" state so the app
// runs in local-only mode.
export function useAuth() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)

  useEffect(() => {
    // When unconfigured, loading already starts false (see useState above).
    if (!isSupabaseConfigured) return undefined

    let active = true

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setUser(data.session?.user ?? null)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
    })

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  function signInWithGoogle() {
    if (!supabase) return undefined
    return supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + window.location.pathname,
      },
    })
  }

  function signOut() {
    if (!supabase) return undefined
    return supabase.auth.signOut()
  }

  return { user, loading, signInWithGoogle, signOut }
}
