import React, { useEffect, useState } from 'react'
import { db, Transaction, Account } from '../db/indexeddb'
import { formatCurrency } from '../utils/currency'
import { Chart as ChartJS, ArcElement, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js'
import { Bar, Pie } from 'react-chartjs-2'

ChartJS.register(ArcElement, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

export default function DashboardPage() {
  const [tx, setTx] = useState<Transaction[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [currency, setCurrency] = useState('USD')
  
  useEffect(() => {
    let mounted = true
    Promise.all([
      db.getAll<Transaction>('transactions'),
      db.getAll<Account>('accounts'),
      db.getMeta<string>('currency')
    ]).then(([transactions, accs, curr]) => {
      if (mounted) {
        setTx(transactions)
        setAccounts(accs)
        setCurrency(curr || 'USD')
        setLoading(false)
      }
    })
    return () => { mounted = false }
  }, [])

  const byDate = tx.reduce((acc: Record<string, number>, t) => {
    const d = t.date
    acc[d] = (acc[d] || 0) + t.lines.reduce((s, l) => s + l.amount, 0)
    return acc
  }, {})

  const labels = Object.keys(byDate).sort()
  const data = {
    labels,
    datasets: [
      {
        label: 'Net amount',
        data: labels.map(l => byDate[l]),
        backgroundColor: 'rgba(14,165,164,0.6)'
      }
    ]
  }

  // Account balances for pie chart
  const accountData = {
    labels: accounts.filter(a => (a.balance || 0) > 0).map(a => a.name),
    datasets: [{
      data: accounts.filter(a => (a.balance || 0) > 0).map(a => a.balance || 0),
      backgroundColor: [
        '#0ea5a4', '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
        '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#06b6d4'
      ]
    }]
  }

  // Calculate totals
  const totalBalance = accounts.reduce((sum, a) => sum + (a.balance || 0), 0)
  const recentTx = tx.slice(-5).reverse()

  return (
    <div className="page container">
      <h2>📊 Dashboard</h2>
      {loading ? (
        <div className="card" style={{padding: 20, textAlign: 'center', color: '#6b7280'}}>Loading dashboard...</div>
      ) : (
        <>
          {/* Summary Cards */}
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 12}}>
            <div className="card">
              <div style={{fontSize: '0.875rem', color: '#6b7280', marginBottom: 4}}>Total Balance</div>
              <div style={{fontSize: '1.5rem', fontWeight: 'bold', color: '#0ea5a4'}}>
                {formatCurrency(totalBalance, currency)}
              </div>
            </div>
            <div className="card">
              <div style={{fontSize: '0.875rem', color: '#6b7280', marginBottom: 4}}>Accounts</div>
              <div style={{fontSize: '1.5rem', fontWeight: 'bold', color: '#3b82f6'}}>{accounts.length}</div>
            </div>
            <div className="card">
              <div style={{fontSize: '0.875rem', color: '#6b7280', marginBottom: 4}}>Transactions</div>
              <div style={{fontSize: '1.5rem', fontWeight: 'bold', color: '#10b981'}}>{tx.length}</div>
            </div>
          </div>

          {/* Charts */}
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12, marginBottom: 12}}>
            <section className="card">
              <h3 style={{marginTop: 0}}>Transaction History</h3>
              <div className="chart">
                {labels.length > 0 ? (
                  <Bar data={data} />
                ) : (
                  <div style={{padding: 40, textAlign: 'center', color: '#6b7280'}}>No transactions yet</div>
                )}
              </div>
            </section>

            <section className="card">
              <h3 style={{marginTop: 0}}>Account Distribution</h3>
              <div style={{maxWidth: 250, margin: '0 auto', padding: '20px 0'}}>
                {accounts.filter(a => (a.balance || 0) > 0).length > 0 ? (
                  <Pie data={accountData} />
                ) : (
                  <div style={{padding: 40, textAlign: 'center', color: '#6b7280'}}>No account balances</div>
                )}
              </div>
            </section>
          </div>

          {/* Recent Transactions */}
          <section className="card">
            <h3 style={{marginTop: 0, marginBottom: 12}}>Recent Transactions</h3>
            {recentTx.length > 0 ? (
              <ul className="list">
                {recentTx.map((t) => (
                  <li key={t.id} style={{padding: '8px 0', borderBottom: '1px solid #f3f4f6'}}>
                    <div style={{display: 'flex', justifyContent: 'space-between'}}>
                      <span style={{fontWeight: 500}}>{t.description || 'No description'}</span>
                      <span style={{fontSize: '0.875rem', color: '#6b7280'}}>{t.date}</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div style={{padding: 20, textAlign: 'center', color: '#6b7280'}}>No recent transactions</div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
