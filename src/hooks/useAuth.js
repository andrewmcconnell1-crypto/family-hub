import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { App as CapacitorApp } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { isSupabaseConfigured, supabase } from '../lib/supabase.js'

const isNative = () => Capacitor.isNativePlatform()

// Deep link the native app registers (see AndroidManifest intent-filter).
// Supabase redirects here after Google sign-in; the OS routes it back INTO the
// app so we can finish the login in the app's own storage — which is what keeps
// you signed in across restarts (a plain web redirect would land in the phone's
// browser instead, logging you out of the app every time).
const NATIVE_REDIRECT = 'app.nest.family://auth'

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

    // Native only: catch the deep link Supabase redirects to after Google
    // sign-in and exchange its code for a session, then close the browser tab.
    let urlListener
    if (isNative()) {
      CapacitorApp.addListener('appUrlOpen', async ({ url }) => {
        if (!url || !url.startsWith(NATIVE_REDIRECT)) return
        try {
          const code = new URL(url).searchParams.get('code')
          if (code) await supabase.auth.exchangeCodeForSession(code)
        } catch (err) {
          console.error('Completing sign-in failed', err)
        } finally {
          Browser.close().catch(() => {})
        }
      }).then((handle) => {
        urlListener = handle
      })
    }

    return () => {
      active = false
      listener.subscription.unsubscribe()
      urlListener?.remove()
    }
  }, [])

  async function signInWithGoogle() {
    if (!supabase) return

    if (isNative()) {
      // Open Google in the system browser (Google blocks OAuth inside embedded
      // web views), and bring the result back via the deep link above.
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: NATIVE_REDIRECT, skipBrowserRedirect: true },
      })
      if (error) throw error
      if (data?.url) await Browser.open({ url: data.url })
      return
    }

    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + window.location.pathname },
    })
  }

  function signOut() {
    if (!supabase) return undefined
    return supabase.auth.signOut()
  }

  return { user, loading, signInWithGoogle, signOut }
}
