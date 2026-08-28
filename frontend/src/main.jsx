import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { AuthProvider } from './auth/AuthContext.jsx'
import { ToastProvider } from './components/ToastContext.jsx'
// Self-hosted, weight-axis-only fonts. `unicode-range` in these files means the
// browser only downloads the latin subset for English text.
import '@fontsource-variable/inter/wght.css'
import '@fontsource-variable/bricolage-grotesque/wght.css'
import './styles.css'

// GoogleOAuthProvider (and the ~50KB GIS script it injects) now lives inside the
// Login page only — no reason to load it on the catalog / detail pages.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
