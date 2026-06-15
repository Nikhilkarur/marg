import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { SafeModeProvider } from '@/hooks/useSafeMode'
import App from '@/App'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <SafeModeProvider>
        <App />
      </SafeModeProvider>
    </BrowserRouter>
  </StrictMode>,
)
