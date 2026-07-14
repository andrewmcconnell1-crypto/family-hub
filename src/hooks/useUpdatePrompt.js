import { useEffect, useRef, useState } from 'react'

// Polls the deployed version.json and flips to true when the build id changes
// from the one this tab loaded with — i.e. a new version has been deployed
// while the app was open. Offline the fetch just fails and returns null, so
// there's no false alarm.
const POLL_MS = 15 * 60 * 1000

export function useUpdatePrompt() {
  const [updateReady, setUpdateReady] = useState(false)
  const loadedId = useRef(null)

  useEffect(() => {
    if (!import.meta.env.PROD) return undefined

    let cancelled = false
    const url = `${import.meta.env.BASE_URL}version.json`

    async function fetchBuildId() {
      try {
        const response = await fetch(`${url}?ts=${Date.now()}`, { cache: 'no-store' })
        if (!response.ok) return null
        const data = await response.json()
        return data?.buildId ?? null
      } catch {
        return null
      }
    }

    async function check() {
      const id = await fetchBuildId()
      if (cancelled || id == null) return
      if (loadedId.current == null) {
        loadedId.current = id // baseline: the build this tab is running
      } else if (id !== loadedId.current) {
        setUpdateReady(true)
      }
    }

    check()
    const interval = window.setInterval(check, POLL_MS)

    function onVisible() {
      if (document.visibilityState === 'visible') check()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  return updateReady
}
