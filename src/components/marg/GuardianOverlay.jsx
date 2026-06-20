import { ShieldCheck, Mic, X, ShieldAlert, Check } from 'lucide-react'
import { useGuardian } from '@/hooks/useGuardian'
import { useT } from '@/lib/i18n'
import { Button } from '@/components/ui/button'

/**
 * Persistent UI for the AI Audio Guardian: a small "listening" status pill and the
 * full-screen distress countdown. Mounted once in AppLayout so it follows the user
 * across pages while armed.
 */
export function GuardianOverlay() {
  const { armed, status, countdown, disarm, cancelCountdown, lastResult } = useGuardian()

  return (
    <>
      {/* Listening status pill */}
      {armed && (status === 'listening' || status === 'sent') && (
        <div className="fixed inset-x-0 top-3 z-[55] flex justify-center px-4 md:top-20">
          <div className="flex items-center gap-2.5 rounded-full border border-emerald-200 bg-white/95 py-2 pl-3 pr-2 shadow-lg backdrop-blur">
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
            </span>
            <Mic className="size-4 text-emerald-600" />
            <span className="text-xs font-semibold text-marg-text">Guardian active</span>
            <button
              type="button"
              onClick={disarm}
              aria-label="Turn off Guardian"
              className="ml-1 flex size-6 items-center justify-center rounded-full text-marg-muted hover:bg-gray-100"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}

      {/* Distress countdown — auto-fires SOS unless cancelled */}
      {(status === 'countdown' || status === 'sending') && (
        <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-marg-danger/95 p-6 text-center text-white">
          <ShieldAlert className="size-12 animate-pulse" />
          <h2 className="mt-4 text-2xl font-bold">Distress detected</h2>
          <p className="mt-1 max-w-xs text-sm text-white/90">
            Sending an SOS with your live location to your emergency contact.
          </p>
          <div className="my-6 flex size-32 items-center justify-center rounded-full border-4 border-white/40">
            <span className="text-6xl font-bold tabular-nums">
              {status === 'sending' ? '…' : countdown}
            </span>
          </div>
          {status === 'countdown' ? (
            <button
              type="button"
              onClick={cancelCountdown}
              className="w-full max-w-xs rounded-xl bg-white px-6 py-4 text-lg font-bold text-marg-danger shadow-lg transition-transform active:scale-95"
            >
              I&apos;m safe — Cancel
            </button>
          ) : (
            <p className="text-sm font-medium text-white/90">Sending…</p>
          )}
        </div>
      )}

      {/* Brief auto-sent confirmation */}
      {status === 'sent' && (
        <div className="fixed inset-x-0 bottom-24 z-[60] flex justify-center px-4 md:bottom-6">
          <div className="flex items-center gap-2 rounded-xl bg-marg-text px-4 py-3 text-sm font-medium text-white shadow-xl">
            <Check className="size-4 text-emerald-400" />
            SOS auto-sent to {lastResult?.contactName || 'your contact'}
            {lastResult?.lat && (
              <span className="text-white/70">· {lastResult.lat.toFixed(3)}, {lastResult.lng.toFixed(3)}</span>
            )}
          </div>
        </div>
      )}
    </>
  )
}

/**
 * Inline toggle card for arming the Guardian — placed on Home under Women Safety
 * Mode. Shows a one-tap "test" so a demo never depends on actually screaming.
 */
export function GuardianToggleCard() {
  const { armed, status, sensitivity, setSensitivity, toggle, triggerTest } = useGuardian()
  const { t } = useT()
  const error = status === 'error'

  return (
    <div
      className={`rounded-xl border p-4 transition-colors duration-200 ${
        armed ? 'border-emerald-300 bg-emerald-50' : 'border-marg-border bg-white'
      }`}
    >
      <div className="flex items-center gap-3">
        <ShieldCheck className={`size-8 shrink-0 ${armed ? 'text-emerald-600' : 'text-marg-muted'}`} />
        <div className="flex-1">
          <p className="text-sm font-semibold text-marg-text">{t('guardian.title')}</p>
          <p className="mt-0.5 text-xs text-marg-muted">
            {armed ? t('guardian.active') : t('guardian.idle')}
          </p>
        </div>
        <Button
          variant={armed ? 'outline' : 'primary'}
          size="sm"
          onClick={toggle}
        >
          {armed ? t('guardian.stop') : t('guardian.activate')}
        </Button>
      </div>

      {error && (
        <p className="mt-2 text-xs text-marg-danger">
          Microphone access denied — allow it in your browser to use Guardian.
        </p>
      )}

      {armed && (
        <div className="mt-3 border-t border-emerald-200 pt-3">
          <div className="flex items-center justify-between">
            <label htmlFor="g-sens" className="text-xs font-medium text-marg-muted">{t('guardian.sensitivity')}</label>
            <button
              type="button"
              onClick={triggerTest}
              className="rounded-full bg-marg-text px-3 py-1 text-xs font-semibold text-white active:scale-95"
            >
              {t('guardian.test')}
            </button>
          </div>
          <input
            id="g-sens"
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={sensitivity}
            onChange={(e) => setSensitivity(Number(e.target.value))}
            className="mt-2 w-full accent-emerald-600"
          />
          <p className="mt-2 text-[11px] text-marg-muted">{t('guardian.privacy')}</p>
        </div>
      )}
    </div>
  )
}
