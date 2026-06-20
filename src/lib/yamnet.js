// Real on-device ML for the Guardian: YAMNet (sentinel_audio.tflite), a trained
// neural network that classifies audio into 521 AudioSet classes. Run in the
// browser via tfjs-tflite (WASM). No audio leaves the device.
//
// tfjs + tfjs-tflite are loaded from a CDN at runtime via <script> injection —
// the documented browser path. (The npm build of tfjs-tflite can't be bundled
// because its WASM client is a sibling file Rollup can't resolve.) The DSP
// heuristic in useGuardian.jsx stays as the automatic fallback.
const TF_URL = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js'
// tfjs-tflite's client + WASM runtime are served from our own /public/tflite so
// they load same-origin (the CDN copies get ORB-blocked by the browser).
const TFLITE_URL = '/tflite/tf-tflite.min.js'
const TFLITE_WASM = '/tflite/'

const MODEL_URL = '/models/sentinel_audio.tflite'
const LABELS_URL = '/models/labels.txt'
export const TARGET_SR = 16000
export const WAVE_LEN = 15600 // YAMNet frame = 0.975 s @ 16 kHz

const DISTRESS = new Set([
  'screaming', 'yell', 'shout', 'bellow', 'children shouting',
  'crying, sobbing', 'wail, moan', 'whimper', 'screech',
])

let modelPromise = null
let labels = null
let distressIdx = []
let inputShape = null

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if ([...document.scripts].some((s) => s.src === src)) return resolve()
    const el = document.createElement('script')
    el.src = src
    el.async = true
    el.onload = resolve
    el.onerror = () => reject(new Error(`failed to load ${src}`))
    document.head.appendChild(el)
  })
}

async function loadLabels() {
  const res = await fetch(LABELS_URL)
  const text = await res.text()
  labels = text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
  distressIdx = labels.reduce((acc, l, i) => (DISTRESS.has(l.toLowerCase()) ? (acc.push(i), acc) : acc), [])
}

export function isLoaded() {
  return !!(labels && modelPromise)
}

export async function loadYamnet() {
  if (!modelPromise) {
    modelPromise = (async () => {
      await loadScript(TF_URL)
      await loadScript(TFLITE_URL)
      const tflite = window.tflite
      if (tflite?.setWasmPath) tflite.setWasmPath(TFLITE_WASM)
      await loadLabels()
      const model = await tflite.loadTFLiteModel(MODEL_URL)
      try {
        inputShape = model.inputs?.[0]?.shape || null
        // eslint-disable-next-line no-console
        console.log('[yamnet] loaded. inputs=', JSON.stringify(model.inputs?.map((t) => t.shape)),
          'outputs=', JSON.stringify(model.outputs?.map((t) => t.shape)), 'labels=', labels.length, 'distressIdx=', JSON.stringify(distressIdx))
      } catch (e) {
        // eslint-disable-next-line no-console
        console.log('[yamnet] inspect failed', e)
      }
      return model
    })()
  }
  return modelPromise
}

// Resample an arbitrary-rate mono buffer to exactly WAVE_LEN samples @16kHz.
export function resampleToFrame(buffer, srcRate) {
  const out = new Float32Array(WAVE_LEN)
  const srcLen = buffer.length
  const spanSrc = Math.min(srcLen, Math.round((WAVE_LEN / TARGET_SR) * srcRate))
  const start = srcLen - spanSrc
  for (let i = 0; i < WAVE_LEN; i++) {
    const pos = start + (i / (WAVE_LEN - 1)) * (spanSrc - 1)
    const i0 = Math.floor(pos)
    const i1 = Math.min(srcLen - 1, i0 + 1)
    const frac = pos - i0
    out[i] = (buffer[i0] || 0) * (1 - frac) + (buffer[i1] || 0) * frac
  }
  return out
}

/**
 * Run the model on a 16 kHz waveform (Float32Array, length WAVE_LEN).
 * Returns { distress: 0..1, top: [{label, score}] }.
 */
export async function classify(wave16k) {
  const model = await loadYamnet()
  const tf = window.tf
  return tf.tidy(() => {
    let input
    if (inputShape && inputShape.length > 1) {
      input = tf.tensor(wave16k, inputShape.map((d) => (d > 0 ? d : wave16k.length)))
    } else {
      input = tf.tensor1d(wave16k)
    }
    let out = model.predict(input)
    let scoresT = out
    if (!(out instanceof tf.Tensor)) {
      const arr = Array.isArray(out) ? out : Object.values(out)
      scoresT = arr.find((t) => t.shape[t.shape.length - 1] === labels.length) || arr[0]
    }
    let perClass = scoresT
    while (perClass.rank > 1) perClass = perClass.max(0)
    const scores = perClass.dataSync()

    let distress = 0
    for (const idx of distressIdx) if (scores[idx] > distress) distress = scores[idx]

    const idxs = Array.from(scores.keys()).sort((a, b) => scores[b] - scores[a]).slice(0, 3)
    const top = idxs.map((i) => ({ label: labels[i], score: scores[i] }))
    return { distress, top }
  })
}

// Dev-only console hook to validate model load + I/O shapes (mic path can't run
// in the preview sandbox).
if (import.meta.env.DEV && typeof window !== 'undefined') {
  window.__yamnet = { loadYamnet, classify, resampleToFrame, WAVE_LEN }
}
