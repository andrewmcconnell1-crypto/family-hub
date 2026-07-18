// Generate a fresh VAPID keypair for web-push reminders.
//
//   node scripts/generate-vapid-keys.mjs
//
// Prints two values:
//   1. the public application-server key — paste into PUSH_PUBLIC_KEY in
//      src/lib/push.js (it is public; committing it is fine)
//   2. the VAPID_KEYS JSON — set as a secret on the send-reminders edge
//      function in Supabase. NEVER commit this: it contains the private key.

import crypto from 'node:crypto'

const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
const pub = publicKey.export({ format: 'jwk' })
const priv = privateKey.export({ format: 'jwk' })

const appServerKey = Buffer.concat([
  Buffer.from([4]),
  Buffer.from(pub.x, 'base64url'),
  Buffer.from(pub.y, 'base64url'),
]).toString('base64url')

console.log('PUSH_PUBLIC_KEY (for src/lib/push.js):\n')
console.log(`  ${appServerKey}\n`)
console.log('VAPID_KEYS secret (for the send-reminders edge function — keep private):\n')
console.log(JSON.stringify({ publicKey: pub, privateKey: priv }))
