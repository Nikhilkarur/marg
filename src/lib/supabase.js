import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Only create the client when configured. When null, the app uses built-in
// demo auth (localStorage) so it stays fully usable without Supabase keys.
export const supabase = url && anonKey ? createClient(url, anonKey) : null
export const supabaseEnabled = Boolean(supabase)
