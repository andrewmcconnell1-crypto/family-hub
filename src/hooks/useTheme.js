import { useEffect, useState } from 'react'

const KEY = 'treehouse:theme'

function apply(pref) {
  const dark =
    pref === 'dark' ||
    (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
}

// Appearance preference: 'system' (default) follows the device and tracks it
// live; 'light'/'dark' force a theme. Persisted so index.html can apply it
// before first paint (no flash).
export function useTheme() {
  const [theme, setThemeState] = useState(() => localStorage.getItem(KEY) || 'system')

  useEffect(() => {
    apply(theme)
    if (theme !== 'system') return undefined
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => apply('system')
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [theme])

  const setTheme = (next) => {
    localStorage.setItem(KEY, next)
    setThemeState(next)
  }

  return { theme, setTheme }
}
