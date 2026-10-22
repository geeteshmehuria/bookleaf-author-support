import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <TooltipProvider>
        <App />
        <Toaster position="top-right" />
      </TooltipProvider>
    </BrowserRouter>
  </StrictMode>,
)
