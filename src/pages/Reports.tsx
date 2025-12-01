import React, { useEffect, useState } from 'react'
import { db, Transaction, Account, Budget } from '../db/indexeddb'
import { formatCurrency } from '../utils/currency'
import { Chart as ChartJS, ArcElement, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend } from 'chart.js'
import { Pie, Bar, Line } from 'react-chartjs-2'

ChartJS.register(ArcElement, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend)

export default function ReportsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [loading, setLoading] = useState(true)
  const [currency, setCurrency] = useState('USD')
  const [doubleEntry, setDoubleEntry] = useState(true)
  const [filterTag, setFilterTag] = useState('')
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year' | 'all' | 'custom'>('month')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const [txs, accs, buds, curr, de] = await Promise.all([
      db.getAll<Transaction>('transactions'),
      db.getAll<Account>('accounts'),
      db.getAll<Budget>('budgets'),
      db.getMeta<string>('currency'),
      db.getMeta<boolean>('doubleEntry')
    ])
    setTransactions(txs)
    setAccounts(accs)
    setBudgets(buds)
    setCurrency(curr || 'USD')
    setDoubleEntry(de !== false)
    setLoading(false)
  }

  // Filter transactions by time range
  const getFilteredTransactions = () => {
    const now = new Date()
    let startDateObj: Date
    let endDateObj: Date | null = null

    switch (timeRange) {
      case 'week':
        startDateObj = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case 'month':
        startDateObj = new Date(now.getFullYear(), now.getMonth(), 1)
        break
      case 'year':
        startDateObj = new Date(now.getFullYear(), 0, 1)
        break
      case 'custom':
        if (!startDate) return transactions
        startDateObj = new Date(startDate)
        endDateObj = endDate ? new Date(endDate) : null
        break
      default:
        return transactions
    }

    return transactions.filter(t => {
      const txDate = new Date(t.date)
      const isAfterStart = txDate >= startDateObj
      const isBeforeEnd = endDateObj ? txDate <= endDateObj : true
      const matchesTag = !filterTag || (t.tags && t.tags.some(tag => tag.toLowerCase().includes(filterTag.toLowerCase())))
      return isAfterStart && isBeforeEnd && matchesTag
    })
  }

  const filteredTxs = getFilteredTransactions()

  // Helper function to check if a transaction is a transfer between accounts
  const isTransfer = (tx: Transaction): boolean => {
    // A transfer has exactly 2 lines with opposite amounts (one negative, one positive)
    if (tx.lines.length !== 2) return false
    const amounts = tx.lines.map(l => l.amount)
    // Check if amounts sum to 0 (balanced) and both are for different accounts
    const isBalanced = Math.abs(amounts[0] + amounts[1]) < 0.01
    const differentAccounts = tx.lines[0].accountId !== tx.lines[1].accountId
    return isBalanced && differentAccounts
  }

  // Filter out transfers for expense calculations
  const nonTransferTxs = filteredTxs.filter(tx => !isTransfer(tx))

  // Account balances for pie chart
  const accountBalanceData = {
    labels: accounts.map(a => a.name),
    datasets: [{
      data: accounts.map(a => Math.abs(a.balance || 0)),
      backgroundColor: [
        '#0ea5a4', '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
        '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#06b6d4'
      ]
    }]
  }

  // Spending by account (pie chart) - exclude transfers
  const spendingByAccount: Record<string, number> = {}
  nonTransferTxs.forEach(tx => {
    tx.lines.forEach(line => {
      if (line.amount < 0) {
        const accountName = accounts.find(a => a.id === line.accountId)?.name || 'Unknown'
        spendingByAccount[accountName] = (spendingByAccount[accountName] || 0) + Math.abs(line.amount)
      }
    })
  })
  
  // In double-entry mode, each expense is recorded twice (once positive, once negative)
  // So we divide by 2 to get the actual spending
  if (doubleEntry) {
    Object.keys(spendingByAccount).forEach(key => {
      spendingByAccount[key] /= 2
    })
  }

  const spendingData = {
    labels: Object.keys(spendingByAccount),
    datasets: [{
      data: Object.values(spendingByAccount),
      backgroundColor: [
        '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
        '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9'
      ]
    }]
  }

  // Daily transaction trend - exclude transfers
  const dailyTotals: Record<string, number> = {}
  nonTransferTxs.forEach(tx => {
    const date = tx.date
    const total = tx.lines.reduce((sum, l) => sum + Math.abs(l.amount), 0)
    // In double-entry mode, divide by 2 since each transaction is counted twice
    const adjustedTotal = doubleEntry ? total / 2 : total
    dailyTotals[date] = (dailyTotals[date] || 0) + adjustedTotal
  })

  const sortedDates = Object.keys(dailyTotals).sort()
  const trendData = {
    labels: sortedDates,
    datasets: [{
      label: 'Transaction Volume',
      data: sortedDates.map(d => dailyTotals[d]),
      borderColor: '#0ea5a4',
      backgroundColor: 'rgba(14, 165, 164, 0.1)',
      fill: true
    }]
  }

  // Income vs Expenses - exclude transfers
  let totalIncome = 0
  let totalExpenses = 0
  
  nonTransferTxs.forEach(tx => {
    tx.lines.forEach(line => {
      if (line.amount > 0) {
        totalIncome += line.amount
      } else {
        totalExpenses += Math.abs(line.amount)
      }
    })
  })

  // Adjust for double-entry (each transaction counted twice)
  if (doubleEntry) {
    totalIncome /= 2
    totalExpenses /= 2
  }

  const incomeExpenseData = {
    labels: ['Income', 'Expenses'],
    datasets: [{
      data: [totalIncome, totalExpenses],
      backgroundColor: ['#10b981', '#ef4444']
    }]
  }

  // Top accounts by activity
  const accountActivity: Record<string, number> = {}
  filteredTxs.forEach(tx => {
    tx.lines.forEach(line => {
      const accountName = accounts.find(a => a.id === line.accountId)?.name || 'Unknown'
      accountActivity[accountName] = (accountActivity[accountName] || 0) + 1
    })
  })

  const topAccounts = Object.entries(accountActivity)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)

  // Spending by tag
  const spendingByTag: Record<string, { income: number; expenses: number; count: number }> = {}
  
  filteredTxs.forEach(tx => {
    const tags = tx.tags && tx.tags.length > 0 ? tx.tags : ['Untagged']
    
    tags.forEach(tag => {
      if (!spendingByTag[tag]) {
        spendingByTag[tag] = { income: 0, expenses: 0, count: 0 }
      }
      
      spendingByTag[tag].count++
      
      tx.lines.forEach(line => {
        if (line.amount > 0) {
          spendingByTag[tag].income += line.amount
        } else {
          spendingByTag[tag].expenses += Math.abs(line.amount)
        }
      })
    })
  })

  // Adjust for double-entry
  if (doubleEntry) {
    Object.keys(spendingByTag).forEach(tag => {
      spendingByTag[tag].income /= 2
      spendingByTag[tag].expenses /= 2
    })
  }

  const tagEntries = Object.entries(spendingByTag).sort(([, a], [, b]) => b.expenses - a.expenses)

  return (
    <div className="page container">
      <h2>📈 Reports & Insights</h2>

      {loading ? (
        <div className="card" style={{padding: 20, textAlign: 'center', color: '#6b7280'}}>
          Loading reports...
        </div>
      ) : (
        <>
          <div className="card" style={{marginBottom: 12}}>
            <h3 style={{marginTop: 0, marginBottom: 8}}>📅 Time Range</h3>
            <div style={{display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12}}>
              <button 
                onClick={() => setTimeRange('week')}
                className={timeRange === 'week' ? 'button-primary' : 'button-secondary'}
              >
                📅 Week
              </button>
              <button 
                onClick={() => setTimeRange('month')}
                className={timeRange === 'month' ? 'button-primary' : 'button-secondary'}
              >
                🗓️ Month
              </button>
              <button 
                onClick={() => setTimeRange('year')}
                className={timeRange === 'year' ? 'button-primary' : 'button-secondary'}
              >
                📆 Year
              </button>
              <button 
                onClick={() => setTimeRange('all')}
                className={timeRange === 'all' ? 'button-primary' : 'button-secondary'}
              >
                ∞ All Time
              </button>
              <button 
                onClick={() => setTimeRange('custom')}
                className={timeRange === 'custom' ? 'button-primary' : 'button-secondary'}
              >
                🎯 Custom
              </button>
            </div>
            
            {timeRange === 'custom' && (
              <div style={{display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 8, borderTop: '1px solid var(--border)'}}>
                <div style={{flex: 1, minWidth: 150}}>
                  <label style={{fontSize: '0.875rem', marginBottom: 4}}>Start Date</label>
                  <input 
                    type="date" 
                    value={startDate} 
                    onChange={(e) => setStartDate(e.target.value)}
                    style={{width: '100%'}}
                  />
                </div>
                <div style={{flex: 1, minWidth: 150}}>
                  <label style={{fontSize: '0.875rem', marginBottom: 4}}>End Date (Optional)</label>
                  <input 
                    type="date" 
                    value={endDate} 
                    onChange={(e) => setEndDate(e.target.value)}
                    style={{width: '100%'}}
                  />
                </div>
              </div>
            )}
            
            {/* Tag Filter */}
            <div style={{marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)'}}>
              <label style={{fontSize: '0.875rem', marginBottom: 4, display: 'block'}}>🏷️ Filter by Tag</label>
              <select value={filterTag} onChange={(e) => setFilterTag(e.target.value)} style={{width: '100%'}}>
                <option value="">All tags</option>
                {Array.from(new Set(transactions.flatMap(t => t.tags || []))).sort().map(tag => (
                  <option key={tag} value={tag}>{tag}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Summary Cards */}
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 12}}>
            <div className="card">
              <div style={{fontSize: '0.875rem', color: '#6b7280', marginBottom: 4}}>Total Transactions</div>
              <div style={{fontSize: '1.5rem', fontWeight: 'bold', color: '#0ea5a4'}}>{filteredTxs.length}</div>
            </div>
            <div className="card">
              <div style={{fontSize: '0.875rem', color: '#6b7280', marginBottom: 4}}>Total Income</div>
              <div style={{fontSize: '1.5rem', fontWeight: 'bold', color: '#10b981'}}>{formatCurrency(totalIncome, currency)}</div>
            </div>
            <div className="card">
              <div style={{fontSize: '0.875rem', color: '#6b7280', marginBottom: 4}}>Total Expenses</div>
              <div style={{fontSize: '1.5rem', fontWeight: 'bold', color: '#ef4444'}}>{formatCurrency(totalExpenses, currency)}</div>
            </div>
            <div className="card">
              <div style={{fontSize: '0.875rem', color: '#6b7280', marginBottom: 4}}>Net</div>
              <div style={{fontSize: '1.5rem', fontWeight: 'bold', color: totalIncome - totalExpenses >= 0 ? '#10b981' : '#ef4444'}}>
                {formatCurrency(totalIncome - totalExpenses, currency)}
              </div>
            </div>
          </div>

          {/* Charts */}
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12}}>
            <div className="card">
              <h3 style={{marginTop: 0, marginBottom: 12}}>Income vs Expenses</h3>
              <div style={{maxWidth: 300, margin: '0 auto'}}>
                <Pie data={incomeExpenseData} />
              </div>
            </div>

            <div className="card">
              <h3 style={{marginTop: 0, marginBottom: 12}}>Account Balances</h3>
              <div style={{maxWidth: 300, margin: '0 auto'}}>
                {accounts.length > 0 ? (
                  <Pie data={accountBalanceData} />
                ) : (
                  <div style={{padding: 20, textAlign: 'center', color: '#6b7280'}}>No accounts</div>
                )}
              </div>
            </div>

            <div className="card">
              <h3 style={{marginTop: 0, marginBottom: 12}}>Spending by Account</h3>
              <div style={{maxWidth: 300, margin: '0 auto'}}>
                {Object.keys(spendingByAccount).length > 0 ? (
                  <Pie data={spendingData} />
                ) : (
                  <div style={{padding: 20, textAlign: 'center', color: '#6b7280'}}>No spending data</div>
                )}
              </div>
            </div>
          </div>

          <div className="card" style={{marginTop: 12}}>
            <h3 style={{marginTop: 0, marginBottom: 12}}>Transaction Trend</h3>
            {sortedDates.length > 0 ? (
              <Line data={trendData} options={{maintainAspectRatio: true, responsive: true}} />
            ) : (
              <div style={{padding: 20, textAlign: 'center', color: '#6b7280'}}>No transaction data</div>
            )}
          </div>

          <div className="card" style={{marginTop: 12}}>
            <h3 style={{marginTop: 0, marginBottom: 12}}>Top 5 Most Active Accounts</h3>
            <ul className="list">
              {topAccounts.map(([name, count]) => (
                <li key={name} style={{display: 'flex', justifyContent: 'space-between', padding: '8px 0'}}>
                  <span>{name}</span>
                  <span style={{color: '#6b7280'}}>{count} transactions</span>
                </li>
              ))}
            </ul>
            {topAccounts.length === 0 && (
              <div style={{padding: 20, textAlign: 'center', color: '#6b7280'}}>No activity data</div>
            )}
          </div>

          <div className="card" style={{marginTop: 12}}>
            <h3 style={{marginTop: 0, marginBottom: 12}}>🏷️ Transactions by Tag</h3>
            {tagEntries.length > 0 ? (
              <div style={{overflowX: 'auto'}}>
                <table style={{width: '100%', borderCollapse: 'collapse'}}>
                  <thead>
                    <tr style={{borderBottom: '2px solid var(--border)'}}>
                      <th style={{textAlign: 'left', padding: '12px 8px', fontSize: '0.875rem', color: '#6b7280'}}>Tag</th>
                      <th style={{textAlign: 'right', padding: '12px 8px', fontSize: '0.875rem', color: '#6b7280'}}>Trx</th>
                      <th style={{textAlign: 'right', padding: '12px 8px', fontSize: '0.875rem', color: '#6b7280'}}>Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tagEntries.map(([tag, data]) => {
                      const net = data.income - data.expenses
                      return (
                        <tr key={tag} style={{borderBottom: '1px solid var(--border)'}}>
                          <td style={{padding: '12px 8px', fontWeight: 500}}>
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: 4,
                              background: tag === 'Untagged' ? '#e5e7eb' : '#dbeafe',
                              color: tag === 'Untagged' ? '#6b7280' : '#1e40af',
                              fontSize: '0.875rem'
                            }}>
                              {tag}
                            </span>
                          </td>
                          <td style={{padding: '12px 8px', textAlign: 'right', color: '#6b7280'}}>{data.count}</td>
                          <td style={{padding: '12px 8px', textAlign: 'right', fontWeight: 600, color: net >= 0 ? '#10b981' : '#ef4444'}}>
                            {formatCurrency(net, currency)}
                          </td>
                        </tr>
                      )
                    })}
                    <tr style={{background: 'var(--accent-light)', fontWeight: 700, borderTop: '2px solid var(--border)'}}>
                      <td style={{padding: '12px 8px'}}>Total</td>
                      <td style={{padding: '12px 8px', textAlign: 'right'}}>{filteredTxs.length}</td>
                      <td style={{padding: '12px 8px', textAlign: 'right', color: totalIncome - totalExpenses >= 0 ? '#10b981' : '#ef4444'}}>
                        {formatCurrency(totalIncome - totalExpenses, currency)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{padding: 20, textAlign: 'center', color: '#6b7280'}}>No tagged transactions</div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
