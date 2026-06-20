const express = require('express')
const cors = require('cors')
require('dotenv').config()

const { sosLimiter, chatLimiter, routesLimiter, tripsLimiter } = require('./lib/limits')

const app = express()

// Behind a single reverse proxy in prod (Render/Heroku/etc.) so req.ip and the
// rate limiter see the real client IP. Adjust the hop count for your host.
app.set('trust proxy', 1)

// CORS: lock to the explicit deployed frontend origin(s) — no '*' fallback
// (TASK 5C #9). FRONTEND_URL may be a comma-separated list. Requests with no
// Origin (curl, health checks, server-to-server) are allowed.
const ALLOWED_ORIGINS = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

app.use(
  cors({
    origin(origin, cb) {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true)
      cb(new Error('Not allowed by CORS'))
    },
  }),
)

// Cap body size — no endpoint needs large payloads; blocks trivial abuse.
app.use(express.json({ limit: '64kb' }))

app.use('/api/routes', routesLimiter, require('./routes/routes'))
app.use('/api/safety', require('./routes/safety'))
app.use('/api/sos', sosLimiter, require('./routes/sos'))
app.use('/api/chat', chatLimiter, require('./routes/chat'))
app.use('/api/trips', tripsLimiter, require('./routes/trips'))
app.use('/api/track', require('./routes/track'))

app.get('/', (req, res) =>
  res.json({
    status: 'Marg API online',
    endpoints: ['/api/routes', '/api/safety/heatmap', '/api/sos', '/api/chat', '/api/trips', '/api/track'],
  }),
)

// CORS rejections surface as a generic 403 instead of an unhandled error.
app.use((err, req, res, next) => {
  if (err && err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'Origin not allowed' })
  }
  console.error('[unhandled]', err?.message)
  res.status(500).json({ error: 'Internal error' })
})

const PORT = process.env.PORT || 4000
app.listen(PORT, () => console.log(`Marg backend running on port ${PORT}`))
