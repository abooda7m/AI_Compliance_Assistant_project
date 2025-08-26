// src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

import App from './App'
import AuthGate from './components/AuthGate'
import { ToastProvider } from './components/ui/ToastProvider'
import { I18nProvider } from './lib/i18n'

import MuhkamHome from './pages/MuhkamHome'   // Landing page
import Overview from './pages/Overview'
import UploadPage from './pages/Upload'
import SensitivityPage from './pages/Sensitivity'
import AuditPage from './pages/Audit'
import QAPage from './pages/QA'
import DbAuditPage from './pages/DbAudit'
import Login from './pages/Login'
import Register from './pages/Register'
import Insights from './pages/Insights'           // <-- ADD: import Insights


import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <I18nProvider initialLang="en">
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            {/* ===== Public landing (FIRST PAGE) ===== */}
            <Route path="/" element={<MuhkamHome />} />

            {/* ===== Public auth pages ===== */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Legacy/CTA aliases */}
            <Route path="/get-started" element={<Navigate to="/register" replace />} />
            <Route path="/auth" element={<Navigate to="/login" replace />} />

            {/* ===== App layout + protected routes ===== */}
            <Route element={<App />}>
              <Route path="/overview" element={<AuthGate><Overview /></AuthGate>} />
              <Route path="/upload" element={<AuthGate><UploadPage /></AuthGate>} />
              <Route path="/sensitivity" element={<AuthGate><SensitivityPage /></AuthGate>} />
              <Route path="/audit" element={<AuthGate><AuditPage /></AuthGate>} />
              <Route path="/qa" element={<AuthGate><QAPage /></AuthGate>} />
              <Route path="/db-audit" element={<AuthGate><DbAuditPage /></AuthGate>} />
              <Route path="/insights" element={<AuthGate><Insights /></AuthGate>} /> {/* <-- ADD: insights route */}

              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </I18nProvider>
  </React.StrictMode>
)
