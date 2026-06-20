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
