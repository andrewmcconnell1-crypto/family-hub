import { createClient } from '@supabase/supabase-js'

// These come from Vite env vars (VITE_ prefix = exposed to the browser).
// The anon key is designed to be public — data is protected by row-level
// security in the database, not by hiding the key.
const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// When the keys aren't set the app runs in local-only mode (no sign-in, data
// on-device), so it keeps working before cloud is configured.
export const isSupabaseConfigured = Boolean(url && anonKey)

export const supabase = isSupabaseConfigured ? createClient(url, anonKey) : null
