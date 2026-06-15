// Centralised IST (Asia/Kolkata, UTC+5:30) time helpers.
//
// WHY: Marg's time-of-day logic (night detection, safety scoring, heatmap
// `active_hours`, and the transit schedule timings) must reflect *Chennai*
// local time no matter where the server runs. `new Date().getHours()` returns
// the host's local hour — wrong on a US/EU cloud box. Everything here derives
// wall-clock fields from an explicit `timeZone`, so it is correct regardless of
// the process TZ (proven by test/audit setting TZ=America/Los_Angeles).

const IST_TZ = 'Asia/Kolkata'

const _fmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: IST_TZ,
  hour12: false,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  weekday: 'short',
})

/** Wall-clock parts in IST for an instant (default: now). */
function istParts(date = new Date()) {
  const p = Object.fromEntries(_fmt.formatToParts(date).map((x) => [x.type, x.value]))
  let hour = parseInt(p.hour, 10)
  if (hour === 24) hour = 0 // some engines emit "24" for midnight
  return {
    year: +p.year,
    month: +p.month,
    day: +p.day,
    hour,
    minute: +p.minute,
    second: +p.second,
    weekday: p.weekday, // 'Mon'..'Sun'
  }
}

/** Current hour-of-day (0–23) in IST. */
function istHour(date = new Date()) {
  return istParts(date).hour
}

/** Minutes since 00:00 IST (0–1439). The planner's clock unit. */
function istMinutesSinceMidnight(date = new Date()) {
  const { hour, minute } = istParts(date)
  return hour * 60 + minute
}

/** Format minutes-since-midnight as "HH:MM" (24h, wraps across midnight). */
function hhmm(minutes) {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

/** True Sat/Sun in IST — suburban/MRTS run reduced frequency on weekends. */
function isWeekendIST(date = new Date()) {
  const wd = istParts(date).weekday
  return wd === 'Sat' || wd === 'Sun'
}

/**
 * Night = 20:00–05:59 IST. Single source of truth for the heatmap's
 * `currently_active` night annotation and the safety baseline.
 */
function isNightIST(hour = istHour()) {
  return hour >= 20 || hour < 6
}

/** Coarse band used by the AI chat prompt and route scoring. */
function timeOfDayIST(hour = istHour()) {
  if (hour >= 21 || hour < 5) return 'late night'
  if (hour >= 19) return 'evening'
  if (hour >= 7) return 'daytime'
  return 'early morning'
}

module.exports = {
  IST_TZ,
  istParts,
  istHour,
  istMinutesSinceMidnight,
  hhmm,
  isWeekendIST,
  isNightIST,
  timeOfDayIST,
}
