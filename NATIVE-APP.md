# Nest Android app (reliable alarms)

Web push on Android is unreliable: battery optimisation (Doze) silently drops
normal-priority notifications, so a reminder set for 8:30 might never arrive.
The Nest Android app fixes this. It's a thin native shell around the same live
site, but it schedules reminders as **real on-device alarms** — the same
mechanism a clock app uses. They ring even with no signal and aren't dropped by
battery saving.

## How it works

- The app **loads the live site**
  (`https://andrewmcconnell1-crypto.github.io/family-hub/`), so everyday content
  changes deploy exactly as before — **no rebuild or reinstall** to get new
  features or fixes.
- Whenever you open Nest (and whenever events/to-dos change), it reads your
  upcoming reminders and hands each one to Android as a local notification set
  for its exact time. Ticking a to-do off or moving an event re-syncs the
  alarms automatically.
- Because scheduling happens on-device, **open Nest on the phone every so often**
  so it can pick up items added on other devices and arm alarms for them. It
  keeps ~60 upcoming reminders armed at a time and tops them up on each open.
- You only need to rebuild the APK when the **native** side changes
  (permissions, plugins, the scheduling code) — not for normal app updates.

## Build the APK

1. On GitHub, go to **Actions → "Build Android app" → Run workflow**.
2. When it finishes it publishes a **Release** (`Nest Android (build N)`) with a
   `nest-N.apk` file attached.

## Install on a phone

1. Open that release page **on the phone** and download the `.apk`.
2. Tap it. Android will ask to allow "install unknown apps" for your browser —
   allow it, then install.
3. Open Nest and **allow notifications** when asked.
4. For exact timing, allow **"Alarms & reminders"** if prompted (Settings → Apps
   → Nest → Alarms & reminders). Nest requests this automatically as a
   reminders app, but some phones still ask.

Updates install straight over the top — every build is signed with the same key
(`android/nest-release.keystore`), so you never have to uninstall first.

## Turning reminders on

In Nest, go to **Family → Reminders**. In the app this manages the on-device
alarms and shows how many are currently armed. (In a plain browser the same card
manages web-push notifications instead.)

## Notes

- `android/nest-release.keystore` is a committed, shared signing key. That's
  intentional: this is a private, sideloaded family app, not a Play Store
  listing, so one consistent key keeps updates installing cleanly. It is not a
  secret worth protecting the way a Play Store upload key would be.
- The project is regenerated on each CI build with `npx cap sync android`, so the
  copied web assets and generated config under `android/` aren't committed — only
  the native project source is.
