import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import './index.css'
import { SiteShell } from './components/layout/SiteShell'
import AnalyticsPage from './pages/AnalyticsPage'
import AuditLogPage from './pages/AuditLogPage'
import ConsolePage from './pages/ConsolePage'
import CorrelationPage from './pages/CorrelationPage'
import LandingPage from './pages/LandingPage'
import LiveFeedsPage from './pages/LiveFeedsPage'
import LoginPage from './pages/LoginPage'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route element={<SiteShell />}>
          <Route path="/console" element={<ConsolePage />} />
          <Route path="/live" element={<LiveFeedsPage />} />
          <Route path="/correlation" element={<CorrelationPage />} />
          <Route path="/audit" element={<AuditLogPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
