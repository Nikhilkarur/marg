// Server-side auth verification.
//
// THE PROBLEM (TASK 5A — IDOR): the backend holds the Supabase service_role
// key, which BYPASSES RLS. Trusting a `user_id` from the request body would let
// anyone read/write another user's trips or emergency contact by guessing a
// UUID. FIX: verify the caller's Supabase access token server-side and use the
// verified uid — never the body's user_id.

const supabase = require('./supabase')

/** Extract a Bearer token, or null. */
function bearer(req) {
  const h = req.headers.authorization || ''
  const m = h.match(/^Bearer\s+(.+)$/i)
  return m ? m[1].trim() : null
}

/**
 * Verify the token and return the Supabase user, or null. Validates the JWT
 * against Supabase Auth (works even though our client uses service_role).
 */
async function verifyUser(req) {
  const token = bearer(req)
  if (!token || !supabase) return null
  try {
    const { data, error } = await supabase.auth.getUser(token)
    if (error || !data?.user) return null
    return data.user
  } catch {
    return null
  }
}

/** Express middleware: 401 unless a valid token is present. Sets req.authUser. */
function requireAuth(req, res, next) {
  verifyUser(req)
    .then((user) => {
      if (!user) return res.status(401).json({ error: 'Authentication required' })
      req.authUser = user
      next()
    })
    .catch(() => res.status(401).json({ error: 'Authentication required' }))
}

module.exports = { bearer, verifyUser, requireAuth }
