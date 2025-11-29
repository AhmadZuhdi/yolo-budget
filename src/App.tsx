import React, { useEffect } from 'react'
import { Routes, Route, Link } from 'react-router-dom'
import AccountsPage from './pages/Accounts'
import BudgetsPage from './pages/Budgets'
import TransactionsPage from './pages/Transactions'
import DashboardPage from './pages/Dashboard'
import RecurringTransactionsPage from './pages/RecurringTransactions'
import ReportsPage from './pages/Reports'
import Nav from './components/Nav'
import SettingsPage from './pages/Settings'
import { db } from './db/indexeddb'

export default function App() {
  useEffect(() => {
    // Apply dark mode on initial load
    db.getMeta<boolean>('darkMode').then(darkMode => {
      if (darkMode) {
        document.documentElement.setAttribute('data-theme', 'dark')
      }
    })
  }, [])

  return (
    <div className="app">
      <header className="topbar">
        <h1>Yolo Budget</h1>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/accounts" element={<AccountsPage />} />
          <Route path="/budgets" element={<BudgetsPage />} />
          <Route path="/transactions" element={<TransactionsPage />} />
          <Route path="/recurring" element={<RecurringTransactionsPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
      <Link to="/transactions" className="fab" aria-label="Create transaction">
        <span>+</span>
      </Link>
      <Nav />
    </div>
  )
}
