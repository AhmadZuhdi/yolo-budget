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
      <h2>💰 Budgets</h2>
      {loading ? (
        <div className="card" style={{padding: 20, textAlign: 'center', color: '#6b7280'}}>Loading budgets...</div>
      ) : (
        <>
      <div className="card" style={{marginBottom:12}}>
        <h3 style={{marginTop: 0, marginBottom: 12}}>{editingId ? '✏️ Edit Budget' : '➕ Create Budget'}</h3>
        <input placeholder="Name" value={name} onChange={(e)=>setName(e.target.value)} />
        <input placeholder="Amount" type="number" value={amount} onChange={(e)=>setAmount(Number(e.target.value))} />
        {editingId ? (
          <div style={{display: 'flex', gap: 8}}>
            <button onClick={saveEdit} className="button-primary">💾 Save</button>
            <button onClick={()=>{setEditingId(null); setName(''); setAmount(0)}} className="button-secondary">❌ Cancel</button>
          </div>
        ) : (
          <button onClick={create} className="button-primary">➕ Add Budget</button>
        )}
      </div>

      <ul className="list">
        {items.map((b) => {
          const spending = getSpending(b.id)
          const percentage = Math.min((spending / b.amount) * 100, 100)
          const isOverBudget = spending > b.amount
          
          return (
          <li key={b.id} style={{padding:'8px 12px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:'0.875rem',fontWeight:500,marginBottom:2}}>{b.name}</div>
                <div style={{fontSize:'0.75rem',color:'#6b7280'}}>
                  <span style={{color: isOverBudget ? '#ef4444' : '#10b981', fontWeight: 500}}>
                    {formatCurrency(spending, currency)}
                  </span>
                  {' '} of {formatCurrency(b.amount, currency)}
                  {' '}({percentage.toFixed(0)}%)
                </div>
              </div>
              <div style={{position:'relative',flexShrink:0}}>
                <button 
                  onClick={(e) => {
                    e.stopPropagation()
                    setOpenMenuId(openMenuId === b.id ? null : b.id)
                  }}
                  style={{padding:'6px 12px',fontSize:'1rem',background:'transparent',border:'none',cursor:'pointer'}}
                >
                  ⋮
                </button>
                {openMenuId === b.id && (
                  <>
                    <div 
                      style={{position:'fixed',top:0,left:0,right:0,bottom:0,zIndex:998}} 
                      onClick={() => setOpenMenuId(null)}
                    />
                    <div style={{
                      position:'absolute',
                      right:0,
                      top:'100%',
                      background:'white',
                      border:'1px solid #e5e7eb',
                      borderRadius:6,
                      boxShadow:'0 4px 6px rgba(0,0,0,0.1)',
                      minWidth:140,
                      zIndex:999,
                      overflow:'hidden'
                    }}>
                      <button 
                        onClick={() => {startEdit(b); setOpenMenuId(null)}}
                        style={{
                          width:'100%',
                          padding:'10px 16px',
                          textAlign:'left',
                          background:'white',
                          border:'none',
                          cursor:'pointer',
                          fontSize:'0.875rem',
                          display:'flex',
                          alignItems:'center',
                          gap:8
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                      >
                        <span>✏️</span> Edit
                      </button>
                      <button 
                        onClick={() => {remove(b.id); setOpenMenuId(null)}}
                        style={{
                          width:'100%',
                          padding:'10px 16px',
                          textAlign:'left',
                          background:'white',
                          border:'none',
                          cursor:'pointer',
                          fontSize:'0.875rem',
                          color:'#ef4444',
                          display:'flex',
                          alignItems:'center',
                          gap:8,
                          borderTop:'1px solid #f3f4f6'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#fef2f2'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                      >
                        <span>🗑️</span> Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
            
            <div style={{
              height: 6,
              background: '#e5e7eb',
              borderRadius: 3,
              overflow: 'hidden'
            }}>
              <div style={{
                height: '100%',
                width: `${percentage}%`,
                background: isOverBudget ? '#ef4444' : '#10b981',
                transition: 'width 0.3s ease'
              }} />
            </div>
          </li>
        )
        })}
      </ul>

      {items.length === 0 && (
        <div className="card" style={{padding: 20, textAlign: 'center', color: '#6b7280'}}>
          📊 No budgets yet. Create one above!
        </div>
      )}
      
      <div className="card" style={{marginTop: 12, fontSize: '0.875rem', color: '#6b7280'}}>
        <strong>Note:</strong> Budget tracking uses transactions assigned to each budget.
        Spending is calculated from current month's transactions with negative amounts.
      </div>
        </>
      )}
    </div>
  )
}
