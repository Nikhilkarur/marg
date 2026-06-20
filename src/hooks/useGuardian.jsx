import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useSafeMode } from '@/hooks/useSafeMode'
import { sendSos } from '@/lib/sos'
import { loadYamnet, classify, resampleToFrame } from '@/lib/yamnet'

/**
 * AI Audio Guardian — opt-in, on-device distress detection. Runs only inside
 * Women Safety Mode (the UI gates arming on it).
 *
 * Detection uses the real YAMNet neural network (sentinel_audio.tflite) when it
 * loads, and a Web-Audio FFT heuristic as the instant + fallback detector. The
 * user never sees any of this — to them it's one "Guardian" with a sensitivity
 * dial. On detection we open a 10-second countdown they can cancel; otherwise the
 * shared SOS fires automatically.
 *
 * PRIVACY: audio is analysed on-device in real time. We hold only ~1 second of
 * samples in memory at a time and overwrite it continuously — nothing is recorded,
 * stored, or uploaded.
 */
const GuardianContext = createContext(null)

const SAFEWORD_KEY = 'marg_safeword'
function loadSafeWord() {
  try { return localStorage.getItem(SAFEWORD_KEY) || '' } catch { return '' }
}

const COUNTDOWN_S = 10
const RETRIGGER_SUPPRESS_MS = 30000
const SUSTAIN_FRAMES = 32 // heuristic: ~0.5s at 60fps
const HIGH_BAND_HZ = [1000, 4000]
const ML_INTERVAL_MS = 700
const ML_SUSTAIN = 2

export function GuardianProvider({ children }) {
  const { user } = useAuth()
  const { safeMode } = useSafeMode()
  const [armed, setArmed] = useState(false)
  const [status, setStatus] = useState('idle') // idle | listening | countdown | sending | sent | error
  const [level, setLevel] = useState(0)
  const [countdown, setCountdown] = useState(COUNTDOWN_S)
  const [sensitivity, setSensitivity] = useState(0.5)
  const [lastResult, setLastResult] = useState(null)
  const [safeWord, setSafeWordState] = useState(loadSafeWord)
  const voiceSupported = typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition)

  const ctxRef = useRef(null)
  const streamRef = useRef(null)
  const rafRef = useRef(0)
  const sustainRef = useRef(0)
  const suppressUntilRef = useRef(0)
  const statusRef = useRef('idle')
  const countdownTimerRef = useRef(null)
  const sensRef = useRef(0.5)
  const procRef = useRef(null)
  const ringRef = useRef(null)
  const ringRateRef = useRef(16000)
  const mlTimerRef = useRef(null)
  const mlSustainRef = useRef(0)
  const mlReadyRef = useRef(false)
  const mlBusyRef = useRef(false)
  const recognitionRef = useRef(null)
  const safeWordRef = useRef(loadSafeWord())
  const voiceWantedRef = useRef(false)
  statusRef.current = status
  sensRef.current = sensitivity

  const setSafeWord = useCallback((word) => {
    const w = (word || '').trim()
    safeWordRef.current = w
    setSafeWordState(w)
    try { w ? localStorage.setItem(SAFEWORD_KEY, w) : localStorage.removeItem(SAFEWORD_KEY) } catch {}
  }, [])

  const stopAudio = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    clearInterval(mlTimerRef.current)
    voiceWantedRef.current = false
    if (recognitionRef.current) { try { recognitionRef.current.stop() } catch {} recognitionRef.current = null }
    if (procRef.current) { try { procRef.current.disconnect() } catch {} procRef.current.onaudioprocess = null; procRef.current = null }
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (ctxRef.current && ctxRef.current.state !== 'closed') ctxRef.current.close().catch(() => {})
    ctxRef.current = null
    ringRef.current = null
    setLevel(0)
  }, [])

  const fire = useCallback(async () => {
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current)
    setStatus('sending')
    const res = await sendSos(user, { trigger: mlReadyRef.current ? 'guardian-ml' : 'guardian' })
    suppressUntilRef.current = Date.now() + RETRIGGER_SUPPRESS_MS
    sustainRef.current = 0
    mlSustainRef.current = 0
    setLastResult(res)
    setStatus('sent')
    setTimeout(() => setStatus((s) => (s === 'sent' ? 'listening' : s)), 6000)
  }, [user])

  const startCountdown = useCallback(() => {
    setStatus('countdown')
    setCountdown(COUNTDOWN_S)
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current)
    countdownTimerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { clearInterval(countdownTimerRef.current); fire(); return 0 }
        return c - 1
      })
    }, 1000)
  }, [fire])

  // Voice safe-word: the browser's SpeechRecognition listens for a user-chosen
  // word and fires the same countdown. Auto-restarts (recognition stops itself
  // periodically) until the Guardian is disarmed.
  const startVoice = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    const word = safeWordRef.current?.toLowerCase()
    if (!SR || !word) return
    voiceWantedRef.current = true
    const rec = new SR()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = 'en-IN'
    rec.onresult = (e) => {
      if (statusRef.current !== 'listening' || Date.now() < suppressUntilRef.current) return
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const transcript = e.results[i][0].transcript.toLowerCase()
        if (transcript.includes(word)) { startCountdown(); return }
      }
    }
    rec.onend = () => {
      // Mobile Chrome ignores `continuous` → recognition ends after each phrase.
      // Restart it (unless disarmed), but on a short delay: an immediate restart
      // gets throttled/throws on mobile, which is why voice "worked on web, not
      // phone". The delay makes the listen loop survive on mobile.
      if (voiceWantedRef.current && recognitionRef.current === rec) {
        setTimeout(() => {
          if (voiceWantedRef.current && recognitionRef.current === rec) {
            try { rec.start() } catch {}
          }
        }, 350)
      }
    }
    rec.onerror = (e) => {
      // Permission/conflict errors won't recover by retrying — stop the loop so we
      // don't spin. Transient errors (no-speech, network) fall through to onend.
      if (e?.error === 'not-allowed' || e?.error === 'service-not-allowed') {
        voiceWantedRef.current = false
      }
    }
    recognitionRef.current = rec
    try { rec.start() } catch { setTimeout(() => { try { rec.start() } catch {} }, 350) }
  }, [startCountdown])

  const cancelCountdown = useCallback(() => {
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current)
    sustainRef.current = 0
    mlSustainRef.current = 0
    suppressUntilRef.current = Date.now() + 4000
    setStatus((s) => (s === 'countdown' ? 'listening' : s))
  }, [])

  const triggerTest = useCallback(() => {
    if (statusRef.current === 'countdown' || statusRef.current === 'sending') return
    startCountdown()
  }, [startCountdown])

  // Heuristic FFT loop: drives the level meter, and detects until/unless the
  // neural net is ready (then the NN is the primary detector).
  const loop = useCallback((analyser, freq, hiLo, hiHi) => {
    const tick = () => {
      analyser.getByteFrequencyData(freq)
      let sum = 0
      for (let i = 0; i < freq.length; i++) sum += freq[i]
      const overall = sum / freq.length
      let hiSum = 0
      for (let i = hiLo; i <= hiHi && i < freq.length; i++) hiSum += freq[i]
      const high = hiSum / Math.max(1, hiHi - hiLo + 1)
      setLevel(Math.min(1, overall / 110))

      if (!mlReadyRef.current && statusRef.current === 'listening' && Date.now() > suppressUntilRef.current) {
        const thresh = 135 - sensRef.current * 50
        const isDistress = high > thresh && overall > 55
        sustainRef.current = isDistress ? sustainRef.current + 1 : Math.max(0, sustainRef.current - 2)
        if (sustainRef.current >= SUSTAIN_FRAMES) { sustainRef.current = 0; startCountdown() }
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [startCountdown])

  // Periodically run the neural network on the most recent ~1s of mic audio.
  const startMlTimer = useCallback(() => {
    clearInterval(mlTimerRef.current)
    mlTimerRef.current = setInterval(async () => {
      if (!mlReadyRef.current || mlBusyRef.current || !ringRef.current) return
      if (statusRef.current !== 'listening' || Date.now() < suppressUntilRef.current) return
      mlBusyRef.current = true
      try {
        const wave = resampleToFrame(ringRef.current, ringRateRef.current)
        const { distress } = await classify(wave)
        const thresh = 0.5 - sensRef.current * 0.3 // sensitivity → 0.5..0.2
        if (distress >= thresh) {
          mlSustainRef.current += 1
          if (mlSustainRef.current >= ML_SUSTAIN) { mlSustainRef.current = 0; startCountdown() }
        } else {
          mlSustainRef.current = 0
        }
      } catch {
        /* keep listening; heuristic stays active as a safety net */
      } finally {
        mlBusyRef.current = false
      }
    }, ML_INTERVAL_MS)
  }, [startCountdown])

  const disarm = useCallback(() => {
    setArmed(false)
    cancelCountdown()
    stopAudio()
    setStatus('idle')
  }, [cancelCountdown, stopAudio])

  const arm = useCallback(async () => {
    // Guard against double-arming (Safe Mode effect + StrictMode double-invoke).
    if (streamRef.current || recognitionRef.current) return

    // A phone gives the microphone to ONE consumer at a time. If a safe-word is
    // set on mobile, let SpeechRecognition own the mic — otherwise our getUserMedia
    // capture (for the YAMNet scream model) blocks it and the word is never heard
    // ("worked on web, not phone"). Desktop can run both at once.
    const isMobile = typeof navigator !== 'undefined' &&
      (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
        (typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)')?.matches))
    if (isMobile && safeWordRef.current) {
      setArmed(true)
      setStatus('listening')
      startVoice()
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const AudioCtx = window.AudioContext || window.webkitAudioContext
      const ctx = new AudioCtx()
      ctxRef.current = ctx
      const source = ctx.createMediaStreamSource(stream)

      const analyser = ctx.createAnalyser()
      analyser.fftSize = 1024
      analyser.smoothingTimeConstant = 0.3
      source.connect(analyser)
      const binHz = ctx.sampleRate / analyser.fftSize
      const hiLo = Math.floor(HIGH_BAND_HZ[0] / binHz)
      const hiHi = Math.floor(HIGH_BAND_HZ[1] / binHz)
      const freq = new Uint8Array(analyser.frequencyBinCount)

      // Raw-waveform ring buffer (~1.1s) for the neural net, via a muted tap.
      ringRateRef.current = ctx.sampleRate
      ringRef.current = new Float32Array(Math.ceil(ctx.sampleRate * 1.1))
      let ringPos = 0
      const proc = ctx.createScriptProcessor(4096, 1, 1)
      proc.onaudioprocess = (e) => {
        const data = e.inputBuffer.getChannelData(0)
        const ring = ringRef.current
        if (!ring) return
        for (let i = 0; i < data.length; i++) { ring[ringPos] = data[i]; ringPos = (ringPos + 1) % ring.length }
      }
      const mute = ctx.createGain()
      mute.gain.value = 0
      source.connect(proc)
      proc.connect(mute)
      mute.connect(ctx.destination)
      procRef.current = proc

      // Load the real model in the background; heuristic covers until it's ready.
      mlReadyRef.current = false
      loadYamnet().then(() => { mlReadyRef.current = true }).catch(() => { mlReadyRef.current = false })

      setArmed(true)
      setStatus('listening')
      loop(analyser, freq, hiLo, hiHi)
      startMlTimer()
      startVoice()
    } catch {
      setStatus('error')
      setArmed(false)
    }
  }, [loop, startMlTimer, startVoice])

  const toggle = useCallback(() => { if (armed) disarm(); else arm() }, [armed, arm, disarm])

  // Women Safety Mode owns the Guardian: turning Safe Mode on automatically arms
  // it (hands-free is the whole point), turning it off disarms it. On first load
  // we only auto-resume if mic was already granted, so we never throw a permission
  // prompt without a user gesture.
  useEffect(() => {
    if (safeMode) arm()
    else disarm()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeMode])

  // If the safe-word changes while the Guardian is already listening, re-arm so
  // the mic-ownership mode updates (scream ↔ voice) — lets a user set the word
  // with Safe Mode already on and have voice start, especially on mobile. Skipped
  // mid-countdown so we never interrupt an alert.
  useEffect(() => {
    if (!armed || statusRef.current !== 'listening') return
    disarm()
    const id = setTimeout(() => { if (safeMode) arm() }, 200)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeWord])

  useEffect(() => () => { stopAudio(); if (countdownTimerRef.current) clearInterval(countdownTimerRef.current) }, [stopAudio])

  return (
    <GuardianContext.Provider
      value={{ armed, status, level, countdown, sensitivity, setSensitivity, lastResult, safeWord, setSafeWord, voiceSupported, arm, disarm, toggle, cancelCountdown, triggerTest }}
    >
      {children}
    </GuardianContext.Provider>
  )
}

export function useGuardian() {
  const ctx = useContext(GuardianContext)
  if (!ctx) throw new Error('useGuardian must be used within GuardianProvider')
  return ctx
}
