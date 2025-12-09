import React, { useEffect, Suspense } from 'react'
import { Routes, Route, Link } from 'react-router-dom'
import Nav from './components/Nav'

// Lazy-loaded pages to enable code-splitting
const AccountsPage = React.lazy(() => import('./pages/Accounts'))
const BudgetsPage = React.lazy(() => import('./pages/Budgets'))
const TransactionsPage = React.lazy(() => import('./pages/Transactions'))
const DashboardPage = React.lazy(() => import('./pages/Dashboard'))
const RecurringTransactionsPage = React.lazy(() => import('./pages/RecurringTransactions'))
const ReportsPage = React.lazy(() => import('./pages/Reports'))
const SettingsPage = React.lazy(() => import('./pages/Settings'))
import { db } from './db/indexeddb'

export default function App() {
  useEffect(() => {
    // Apply dark mode on initial load
    db.getMeta<boolean>('darkMode').then(darkMode => {
      if (darkMode) {
        document.documentElement.setAttribute('data-theme', 'dark')
      }
    })

    // Apply bottom nav mode
    db.getMeta<boolean>('useBottomNav').then(useBottomNav => {
      if (useBottomNav) {
        document.body.classList.add('bottom-nav-mode')
      } else {
        document.body.classList.remove('bottom-nav-mode')
      }
    })

    // Listen for settings changes
    const handleSettingsChange = () => {
      db.getMeta<boolean>('useBottomNav').then(useBottomNav => {
        if (useBottomNav) {
          document.body.classList.add('bottom-nav-mode')
        } else {
          document.body.classList.remove('bottom-nav-mode')
        }
      })
    }
    window.addEventListener('settingsChanged', handleSettingsChange)

    return () => {
      window.removeEventListener('settingsChanged', handleSettingsChange)
    }
  }, [])

  return (
    <div className="app">
      <header className="topbar">
        <h1>Yolo Budget</h1>
      </header>
      <main>
        <Suspense fallback={<div className="card" style={{padding:20}}>Loading...</div>}>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/accounts" element={<AccountsPage />} />
            <Route path="/budgets" element={<BudgetsPage />} />
            <Route path="/transactions" element={<TransactionsPage />} />
            <Route path="/recurring" element={<RecurringTransactionsPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </Suspense>
      </main>
      <Link to="/transactions" className="fab" aria-label="Create transaction">
        <span>+</span>
      </Link>
      <Nav />
    </div>
  )
}
