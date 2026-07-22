// App lock: require the phone's fingerprint / face / PIN to open Nest, since it
// holds private family documents. Native-only; a no-op in a browser. The
// preference is per-device (localStorage), off by default.

import { Capacitor } from '@capacitor/core'
import { BiometricAuth } from '@aparajita/capacitor-biometric-auth'

const KEY = 'nest:appLock'

export const isNativeApp = () => Capacitor.isNativePlatform()
export const isLockEnabled = () => isNativeApp() && localStorage.getItem(KEY) === '1'
export const setLockEnabled = (on) => localStorage.setItem(KEY, on ? '1' : '0')

// Prompt for biometrics, falling back to the device PIN/pattern/password.
// Resolves true when the user authenticates, false if they cancel or fail.
export async function authenticate() {
  if (!isNativeApp()) return true
  try {
    await BiometricAuth.authenticate({
      reason: 'Unlock Nest',
      androidTitle: 'Unlock Nest',
      androidSubtitle: 'Confirm it’s you',
      cancelTitle: 'Cancel',
      allowDeviceCredential: true,
      androidConfirmationRequired: false,
    })
    return true
  } catch {
    return false
  }
}

// Whether the device can authenticate at all (some biometry enrolled, or a
// secure lock screen for the PIN fallback).
export async function canAuthenticate() {
  if (!isNativeApp()) return false
  try {
    const r = await BiometricAuth.checkBiometry()
    return Boolean(r.isAvailable || r.deviceIsSecure)
  } catch {
    return false
  }
}
