import React, { useEffect, useState } from 'react'
import { db, Transaction, Account } from '../db/indexeddb'
import { formatCurrency } from '../utils/currency'
// ChartWrapper dynamically loads Chart.js and react-chartjs-2 when charts are shown
function ChartWrapper({ type, ...props }: any) {
  const LazyComp = React.lazy(async () => {
    const ChartJS = await import('chart.js')
    const { ArcElement, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } = ChartJS
    // @ts-ignore
    ChartJS.Chart.register(ArcElement, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)
    const libs = await import('react-chartjs-2')
    const comp = libs[type]
    return { default: comp }
  })

  return (
    <React.Suspense fallback={<div style={{padding:20}}>Loading chart...</div>}>
      {/* @ts-ignore */}
      <LazyComp {...props} />
    </React.Suspense>
  )
}

export default function DashboardPage() {
  const [tx, setTx] = useState<Transaction[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [currency, setCurrency] = useState('USD')
  const [showCharts, setShowCharts] = useState(false)
  const [showRecent, setShowRecent] = useState(false)
  const [showBalance, setShowBalance] = useState(false)
  
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
          {/* Summary Card - Single Line */}
          <div className="card" style={{marginBottom: 12, padding: '12px 16px'}}>
            <div style={{display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap'}}>
              <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
                <span style={{fontSize: '0.8rem', color: '#6b7280'}}>Balance:</span>
                <span 
                  style={{fontSize: '1.2rem', fontWeight: 'bold', color: '#0ea5a4', cursor: 'pointer', userSelect: 'none'}}
                  onClick={() => setShowBalance(!showBalance)}
                >
                  {showBalance ? formatCurrency(totalBalance, currency) : '••••••'}
                </span>
              </div>
              <div style={{height: 20, width: 1, backgroundColor: '#e5e7eb'}}></div>
              <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
                <span style={{fontSize: '0.8rem', color: '#6b7280'}}>Accounts:</span>
                <span style={{fontSize: '1.2rem', fontWeight: 'bold', color: '#3b82f6'}}>{accounts.length}</span>
              </div>
              <div style={{height: 20, width: 1, backgroundColor: '#e5e7eb'}}></div>
              <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
                <span style={{fontSize: '0.8rem', color: '#6b7280'}}>Transactions:</span>
                <span style={{fontSize: '1.2rem', fontWeight: 'bold', color: '#10b981'}}>{tx.length}</span>
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="card" style={{marginBottom: 12}}>
            <h3 
              style={{marginTop: 0, marginBottom: showCharts ? 12 : 0, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}
              onClick={() => setShowCharts(!showCharts)}
            >
              <span>📊 Charts</span>
              <span style={{fontSize: '1.2rem'}}>{showCharts ? '▼' : '▶'}</span>
            </h3>
            {showCharts && (
              <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12}}>
                <section>
                  <h4 style={{marginTop: 0, fontSize: '1rem'}}>Transaction History</h4>
                  <div className="chart">
                    {labels.length > 0 ? (
                      <ChartWrapper type="Bar" data={data} />
                    ) : (
                      <div style={{padding: 40, textAlign: 'center', color: '#6b7280'}}>No transactions yet</div>
                    )}
                  </div>
                </section>

                <section>
                  <h4 style={{marginTop: 0, fontSize: '1rem'}}>Account Distribution</h4>
                  <div style={{maxWidth: 250, margin: '0 auto', padding: '20px 0'}}>
                    {accounts.filter(a => (a.balance || 0) > 0).length > 0 ? (
                      <ChartWrapper type="Pie" data={accountData} />
                    ) : (
                      <div style={{padding: 40, textAlign: 'center', color: '#6b7280'}}>No account balances</div>
                    )}
                  </div>
                </section>
              </div>
            )}
          </div>

          {/* Recent Transactions */}
          <section className="card">
            <h3 
              style={{marginTop: 0, marginBottom: showRecent ? 12 : 0, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}
              onClick={() => setShowRecent(!showRecent)}
            >
              <span>🕒 Recent Transactions</span>
              <span style={{fontSize: '1.2rem'}}>{showRecent ? '▼' : '▶'}</span>
            </h3>
            {showRecent && (
              recentTx.length > 0 ? (
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
              )
            )}
          </section>
        </>
      )}
    </div>
  )
}
