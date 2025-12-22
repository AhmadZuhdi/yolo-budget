import React, { useEffect, useState } from 'react'
import { db, Budget, Transaction, Account } from '../db/indexeddb'
import { formatCurrency } from '../utils/currency'

export default function BudgetsPage() {
  const [items, setItems] = useState<Budget[]>([])
  const [name, setName] = useState('')
  const [amount, setAmount] = useState<number>(0)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [currency, setCurrency] = useState('USD')
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categoryFilter, setCategoryFilter] = useState('')
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    Promise.all([
      db.getAll<Budget>('budgets'),
      db.getMeta<string>('currency'),
      db.getAll<Transaction>('transactions'),
      db.getAll<Account>('accounts')
    ]).then(([budgets, curr, txs, accs]) => {
      if (mounted) {
        setItems(budgets)
        setCurrency(curr || 'USD')
        setTransactions(txs)
        setAccounts(accs)
        setLoading(false)
      }
    })
    return () => { mounted = false }
  }, [])

  // Calculate spending for a budget by summing transactions assigned to it
  const getSpending = (budgetId: string) => {
    // Get current month transactions
    const now = new Date()
    const currentMonth = now.toISOString().slice(0, 7) // YYYY-MM
    
    const monthTransactions = transactions.filter(t => 
      t.date.startsWith(currentMonth) && t.budgetId === budgetId
    )
    
    let totalSpending = 0
    for (const tx of monthTransactions) {
      for (const line of tx.lines) {
        // Count absolute amounts as spending (regardless of sign)
        // In double-entry, expenses are negative; in simple mode, expenses are also negative
        if (line.amount < 0) {
          totalSpending += Math.abs(line.amount)
        }
      }
    }
    
    return totalSpending
  }

  async function create() {
    if (!name) return
    const b: Budget = { id: `bud:${Date.now()}`, name, amount }
    await db.put('budgets', b)
    const [budgets, txs] = await Promise.all([
      db.getAll('budgets'),
      db.getAll('transactions')
    ])
    setItems(budgets)
    setTransactions(txs)
    setName('')
    setAmount(0)
  }

  async function startEdit(b: Budget) {
    setEditingId(b.id)
    setName(b.name)
    setAmount(b.amount)
  }

  async function saveEdit() {
    if (!editingId) return
    const b = await db.get<Budget>('budgets', editingId)
    if (!b) return
    b.name = name
    b.amount = amount
    await db.put('budgets', b)
    const budgets = await db.getAll('budgets')
    setItems(budgets)
    setEditingId(null)
    setName('')
    setAmount(0)
  }

  async function remove(id: string) {
    await db.delete('budgets', id)
    setItems(await db.getAll('budgets'))
  }

  return (
    <div className="page container">
      <h2 style={{marginBottom: 24, fontSize: '1.75rem', fontWeight: 700}}>💰 Budgets</h2>
      {loading ? (
        <div className="card" style={{padding: 40, textAlign: 'center', color: '#6b7280'}}>
          <div style={{fontSize: '2rem', marginBottom: 8}}>⏳</div>
          Loading budgets...
        </div>
      ) : (
        <>
      <div className="card" style={{marginBottom: 20}}>
        <h3 style={{marginTop: 0, marginBottom: 16}}>{editingId ? '✏️ Edit Budget' : '➕ Add New Budget'}</h3>
        <div style={{display: 'grid', gap: 12}}>
          <div>
            <label>Budget Name</label>
            <input placeholder="e.g., Groceries, Entertainment" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label>Budget Amount</label>
            <input placeholder="Amount" type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          </div>
          {editingId ? (
            <div style={{display: 'flex', gap: 8}}>
              <button onClick={saveEdit} className="button-primary">💾 Save</button>
              <button onClick={() => {setEditingId(null); setName(''); setAmount(0)}} className="button-secondary">❌ Cancel</button>
            </div>
          ) : (
            <button onClick={create} style={{marginTop: 8}}>➕ Add Budget</button>
          )}
        </div>
      </div>

      <div className="card">
        <ul className="list">
          {items.map((b) => {
            const spending = getSpending(b.id)
            const percentage = (spending / b.amount) * 100
            const isOverBudget = spending > b.amount
            const difference = spending - b.amount
            const progressBarWidth = Math.min(percentage, 100)
            
            return (
            <li key={b.id} style={{padding:'12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: items.length > 0 ? 12 : 0}}>
              <div style={{flex: 1, minWidth: 0}}>
                <div style={{fontSize: '0.9rem', fontWeight: 500, marginBottom: 8}}>{b.name}</div>
                <div style={{fontSize: '0.75rem', color: '#6b7280', marginBottom: 6}}>
                  <span style={{color: isOverBudget ? '#ef4444' : '#10b981', fontWeight: 500}}>
                    {formatCurrency(spending, currency)}
                  </span>
                  {' '} of {formatCurrency(b.amount, currency)}
                  {isOverBudget ? (
                    <>
                      {' '}({percentage.toFixed(0)}%) <span style={{color: '#ef4444', fontWeight: 500}}>+{formatCurrency(difference, currency)} over</span>
                    </>
                  ) : (
                    <>
                      {' '}({percentage.toFixed(0)}%)
                    </>
                  )}
                </div>
                <div style={{
                  height: 6,
                  background: '#e5e7eb',
                  borderRadius: 3,
                  overflow: 'hidden'
                }}>
                  <div style={{
                    height: '100%',
                    width: `${progressBarWidth}%`,
                    background: isOverBudget ? '#ef4444' : '#10b981',
                    transition: 'width 0.3s ease'
                  }} />
                </div>
              </div>
              <div style={{position: 'relative', flexShrink: 0, marginLeft: 12}}>
                <button 
                  onClick={(e) => {
                    e.stopPropagation()
                    setOpenMenuId(openMenuId === b.id ? null : b.id)
                  }}
                  style={{padding: '6px 12px', fontSize: '1rem', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text)'}}
                >
                  ⋮
                </button>
                {openMenuId === b.id && (
                  <>
                    <div 
                      style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 998}} 
                      onClick={() => setOpenMenuId(null)}
                    />
                    <div style={{
                      position: 'absolute',
                      right: 0,
                      top: '100%',
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                      minWidth: 140,
                      zIndex: 999,
                      overflow: 'hidden'
                    }}>
                      <button 
                        onClick={() => {startEdit(b); setOpenMenuId(null)}}
                        style={{
                          width: '100%',
                          padding: '10px 16px',
                          textAlign: 'left',
                          background: 'var(--bg-secondary)',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '0.875rem',
                          color: 'var(--text)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--accent-light)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
                      >
                        <span>✏️</span> Edit
                      </button>
                      <button 
                        onClick={() => {remove(b.id); setOpenMenuId(null)}}
                        style={{
                          width: '100%',
                          padding: '10px 16px',
                          textAlign: 'left',
                          background: 'var(--bg-secondary)',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '0.875rem',
                          color: 'var(--danger)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          borderTop: '1px solid var(--border)'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--accent-light)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
                      >
                        <span>🗑️</span> Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            </li>
          )
          })}
        </ul>

        {items.length === 0 && (
          <div style={{padding: 20, textAlign: 'center', color: '#6b7280'}}>
            <div style={{fontSize: '2rem', marginBottom: 8}}>📊</div>
            No budgets yet. Create one above!
          </div>
        )}

        {items.length > 0 && (
          <div style={{
            padding: 12,
            marginTop: 12,
            borderTop: '1px solid var(--border)',
            background: 'var(--accent-light)',
            borderRadius: 6
          }}>
            <div style={{fontSize: '0.875rem', color: 'var(--text)'}}>
              <strong>Total Budget:</strong>{' '}
              <span style={{fontSize: '1rem', fontWeight: 600}}>
                {formatCurrency(items.reduce((sum, b) => sum + b.amount, 0), currency)}
              </span>
            </div>
            <div style={{fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 4}}>
              Allocated across {items.length} {items.length === 1 ? 'budget' : 'budgets'}
            </div>
          </div>
        )}
      </div>

      <div className="card" style={{marginTop: 12, fontSize: '0.875rem', color: 'var(--text-secondary)'}}>
        <strong>ℹ️ How Budget Tracking Works:</strong>
        <ul style={{margin: '8px 0', paddingLeft: 20}}>
          <li>Spending is calculated from current month's transactions assigned to each budget</li>
          <li>Only expenses (negative amounts) are counted toward budget usage</li>
          <li>Red progress bar indicates when you've exceeded the budget</li>
        </ul>
      </div>
        </>
      )}
    </div>
  )
}
