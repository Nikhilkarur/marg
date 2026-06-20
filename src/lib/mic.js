// Microphone permission helper for the AI Audio Guardian.
//
// We pre-request mic access on the login screen so the browser permission prompt
// appears *before* the user is inside the app. Granting early means the Guardian
// can start instantly later without a second, mid-session prompt. We immediately
// stop the tracks — this only secures the permission, it does not keep the mic on.

const GRANTED_KEY = 'marg_mic_granted'

export function micPreviouslyGranted() {
  try {
    return localStorage.getItem(GRANTED_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * Ask for microphone permission once. Resolves to 'granted' | 'denied' | 'unsupported'.
 * Safe to call on page load; never throws.
 */
export async function requestMicPermission() {
  if (!navigator.mediaDevices?.getUserMedia) return 'unsupported'
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    stream.getTracks().forEach((t) => t.stop()) // release immediately
    try { localStorage.setItem(GRANTED_KEY, '1') } catch {}
    return 'granted'
  } catch {
    return 'denied'
  }
}
