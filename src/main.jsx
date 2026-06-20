import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { SafeModeProvider } from '@/hooks/useSafeMode'
import { GuardianProvider } from '@/hooks/useGuardian'
import { LanguageProvider } from '@/lib/i18n'
import App from '@/App'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <LanguageProvider>
        <SafeModeProvider>
          <GuardianProvider>
            <App />
          </GuardianProvider>
        </SafeModeProvider>
      </LanguageProvider>
    </BrowserRouter>
  </StrictMode>,
)

// Register the PWA service worker in production so Marg installs to the home
// screen and launches fullscreen. Dev is skipped to avoid caching the HMR server.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
