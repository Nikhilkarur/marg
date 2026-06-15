const { createClient } = require('@supabase/supabase-js')

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

// Null when not configured — route handlers degrade gracefully instead of crashing.
const supabase = url && key ? createClient(url, key) : null

if (!supabase) {
  console.warn('[supabase] SUPABASE_URL / SERVICE_ROLE_KEY not set — DB features disabled.')
}

module.exports = supabase
