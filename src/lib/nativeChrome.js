// Native window chrome for the Android app: status-bar colour that follows the
// theme, and hiding the launch splash once the app has painted. No-op in a
// browser. Keeps the native shell feeling like a real app rather than a web
// page in a frame.

import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'
import { SplashScreen } from '@capacitor/splash-screen'

const isNative = () => Capacitor.isNativePlatform()

// "rgb(250, 247, 240)" -> "#faf7f0" (StatusBar wants a hex string).
function toHex(rgb) {
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(rgb || '')
  if (!m) return '#000000'
  return '#' + [1, 2, 3].map((i) => Number(m[i]).toString(16).padStart(2, '0')).join('')
}

// Match the status bar to the app's current background + light/dark mode.
export async function applyStatusBarTheme() {
  if (!isNative()) return
  const dark = document.documentElement.getAttribute('data-theme') === 'dark'
  const bg = getComputedStyle(document.body).backgroundColor
  try {
    await StatusBar.setOverlaysWebView({ overlay: false })
    // Style.Dark = light icons (for a dark bar); Style.Light = dark icons.
    await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light })
    await StatusBar.setBackgroundColor({ color: toHex(bg) })
  } catch {
    // Status bar API isn't available on every surface; ignore.
  }
}

let started = false
export async function initNativeChrome() {
  if (!isNative() || started) return
  started = true
  await applyStatusBarTheme()
  // The launch splash stays up (launchAutoHide:false) until we're painted, so
  // there's no white flash while the live site loads. Give the first frame a
  // moment, then reveal.
  setTimeout(() => SplashScreen.hide().catch(() => {}), 250)
}
