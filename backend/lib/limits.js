// Rate limiting (TASK 5C #10). Strict on the endpoints that cost real money /
// quota (SOS → Twilio, chat → Groq), looser on routes. Keyed by IP, plus the
// verified uid when present so one abusive user can't farm the key from many
// tabs. SOS additionally has a per-user 30s throttle (see routes/sos.js).

const rateLimit = require('express-rate-limit')

const json = (msg) => (req, res) => res.status(429).json({ error: msg })
const keyByIpAndUser = (req /*, res */) => `${req.ip}:${req.authUser?.id || 'anon'}`

const sosLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5, // ≤5 SOS/min/IP — the 30s/user guard is the real protection
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyByIpAndUser,
  handler: json('Too many SOS requests — please wait a moment'),
})

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20, // protect the Groq quota
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyByIpAndUser,
  handler: json('Too many chat requests — please slow down'),
})

const routesLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyByIpAndUser,
  handler: json('Too many requests — please slow down'),
})

const tripsLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyByIpAndUser,
  handler: json('Too many requests — please slow down'),
})

module.exports = { sosLimiter, chatLimiter, routesLimiter, tripsLimiter }
