import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useEffect } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import Dashboard from '@/pages/Dashboard'
import Transactions from '@/pages/Transactions'
import Accounts from '@/pages/Accounts'
import Budgets from '@/pages/Budgets'
import Recurring from '@/pages/Recurring'
import Settings from '@/pages/Settings'
import { seedDefaultData } from '@/db/db'
import { processRecurringTransactions } from '@/utils/recurringEngine'

function AppInit() {
  useEffect(() => {
    seedDefaultData()
    processRecurringTransactions().then((n) => {
      if (n > 0) console.log(`[recurring] Generated ${n} transaction(s)`)
    })
  }, [])
  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <AppInit />
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/"             element={<Dashboard />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/accounts"     element={<Accounts />} />
          <Route path="/budgets"      element={<Budgets />} />
          <Route path="/recurring"    element={<Recurring />} />
          <Route path="/settings"     element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
