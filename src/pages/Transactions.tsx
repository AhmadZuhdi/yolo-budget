import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { db, Transaction, TransactionLine, Account, Budget } from '../db/indexeddb'
import { formatCurrency } from '../utils/currency'

export default function TransactionsPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState<Transaction[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [desc, setDesc] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0,10))
  const [budgetId, setBudgetId] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [lineA, setLineA] = useState<{accountId?:string;amount?:number}>({})
  const [lineB, setLineB] = useState<{accountId?:string;amount?:number}>({})
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [currency, setCurrency] = useState('USD')
  const [doubleEntry, setDoubleEntry] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterAccount, setFilterAccount] = useState('')
  const [filterTag, setFilterTag] = useState('')
  
  // Collapsible sections state
  const [showCreateForm, setShowCreateForm] = useState(true)
  const [showTransfer, setShowTransfer] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  
  // Transfer state
  const [transferFrom, setTransferFrom] = useState('')
  const [transferTo, setTransferTo] = useState('')
  const [transferAmount, setTransferAmount] = useState('')
  const [transferDesc, setTransferDesc] = useState('')


  useEffect(() => {
    let mounted = true
    Promise.all([
      db.getAll<Transaction>('transactions'),
      db.getAll<Account>('accounts'),
      db.getMeta<string>('currency'),
      db.getAll<Budget>('budgets'),
      db.getMeta<boolean>('doubleEntry'),
      db.getMeta<string>('defaultAccountId'),
      db.getMeta<string>('defaultBudgetId')
    ]).then(([transactions, accs, curr, buds, de, defAccId, defBudId]) => {
      if (mounted) {
        setItems(transactions)
        setAccounts(accs)
        setCurrency(curr || 'USD')
        setBudgets(buds)
        setDoubleEntry(de !== false) // default to true
        // Apply defaults only if not editing
        if (!editingId && defAccId) {
          setLineA(prev => ({ ...prev, accountId: defAccId }))
        }
        if (!editingId && defBudId) {
          setBudgetId(defBudId)
        }
        setLoading(false)
      }
    })
    return () => { mounted = false }
  }, [])

  const getAccountName = (accountId: string) => {
    return accounts.find(a => a.id === accountId)?.name || accountId
  }

  const getBudgetName = (budgetId?: string) => {
    if (!budgetId) return null
    return budgets.find(b => b.id === budgetId)
  }

  // Get all unique tags from transactions
  const getAllTags = (): string[] => {
    const tagSet = new Set<string>()
    items.forEach(t => {
      if (t.tags) {
        t.tags.forEach(tag => tagSet.add(tag))
      }
    })
    return Array.from(tagSet).sort()
  }

  const filteredItems = items.filter(t => {
    const matchesSearch = !searchTerm || 
      t.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.date.includes(searchTerm)
    const matchesAccount = !filterAccount ||
      t.lines.some(l => l.accountId === filterAccount)
    const matchesTag = !filterTag ||
      (t.tags && t.tags.some(tag => tag.toLowerCase().includes(filterTag.toLowerCase())))
    return matchesSearch && matchesAccount && matchesTag
  }).sort((a, b) => {
    // Sort by date descending (newest first)
    return b.date.localeCompare(a.date) || b.id.localeCompare(a.id)
  })

  async function create() {
    if (!lineA.accountId) return
    
    const aAmt = Number(lineA.amount || 0)
    
    if (doubleEntry) {
      // Double-entry mode: require both accounts and balanced transaction
      if (!lineB.accountId) {
        alert('Double-entry mode requires two accounts')
        return
      }
      const bAmt = Number(lineB.amount || 0)
      if (Math.abs(aAmt + bAmt) > 1e-6) {
        alert('Transaction must balance (sum of lines = 0)')
        return
      }
      
      const tx: Transaction = {
        id: editingId || `tx:${Date.now()}`,
        date,
        description: desc,
        budgetId: budgetId || undefined,
        tags: tagsInput ? tagsInput.split(',').map(t => t.trim()).filter(t => t) : undefined,
        lines: [
          { accountId: lineA.accountId!, amount: aAmt },
          { accountId: lineB.accountId!, amount: bAmt }
        ]
      }
      
      try {
        if (editingId) {
          await db.updateTransaction(tx)
          setEditingId(null)
        } else {
          await db.addTransaction(tx)
        }
        setItems(await db.getAll('transactions'))
        setDesc('')
        setBudgetId('')
        setTagsInput('')
        setLineA({})
        setLineB({})
      } catch (e: any) {
        alert(e.message)
      }
    } else {
      // Simple mode: single account, positive for income, negative for expense
      const tx: Transaction = {
        id: editingId || `tx:${Date.now()}`,
        date,
        description: desc,
        budgetId: budgetId || undefined,
        tags: tagsInput ? tagsInput.split(',').map(t => t.trim()).filter(t => t) : undefined,
        lines: [
          { accountId: lineA.accountId!, amount: aAmt }
        ]
      }
      
      try {
        if (editingId) {
          // In simple mode, we just update the transaction directly
          await db.put('transactions', tx)
          // Update account balance
          const acc = await db.get<Account>('accounts', lineA.accountId!)
          if (acc) {
            const oldTx = items.find(t => t.id === editingId)
            if (oldTx && oldTx.lines[0]) {
              acc.balance = (acc.balance || 0) - oldTx.lines[0].amount + aAmt
              await db.put('accounts', acc)
            }
          }
          setEditingId(null)
        } else {
          await db.add('transactions', tx)
          // Update account balance
          const acc = await db.get<Account>('accounts', lineA.accountId!)
          if (acc) {
            acc.balance = (acc.balance || 0) + aAmt
            await db.put('accounts', acc)
          }
        }
        setItems(await db.getAll('transactions'))
        setDesc('')
        setBudgetId('')
        setTagsInput('')
        setLineA({})
        setLineB({})
      } catch (e: any) {
        alert(e.message)
      }
    }
  }

  function startEdit(txId: string) {
    const tx = items.find(t => t.id === txId)
    if (!tx) return
    setEditingId(tx.id)
    setDesc(tx.description || '')
    setDate(tx.date)
    setBudgetId(tx.budgetId || '')
    setTagsInput(tx.tags ? tx.tags.join(', ') : '')
    setLineA({ accountId: tx.lines[0]?.accountId, amount: tx.lines[0]?.amount })
    if (doubleEntry && tx.lines[1]) {
      setLineB({ accountId: tx.lines[1]?.accountId, amount: tx.lines[1]?.amount })
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete transaction?')) return
    
    if (doubleEntry) {
      await db.deleteTransaction(id)
    } else {
      // Simple mode: update account balance before deleting
      const tx = items.find(t => t.id === id)
      if (tx && tx.lines[0]) {
        const acc = await db.get<Account>('accounts', tx.lines[0].accountId)
        if (acc) {
          acc.balance = (acc.balance || 0) - tx.lines[0].amount
          await db.put('accounts', acc)
        }
      }
      await db.delete('transactions', id)
    }
    
    setItems(await db.getAll('transactions'))
  }

  async function quickTransfer() {
    if (!transferFrom || !transferTo || !transferAmount) {
      alert('Please fill in all transfer fields')
      return
    }
    
    if (transferFrom === transferTo) {
      alert('Cannot transfer to the same account')
      return
    }
    
    const amount = Number(transferAmount)
    if (amount <= 0) {
      alert('Transfer amount must be positive')
      return
    }
    
    const tx: Transaction = {
      id: `tx:${Date.now()}`,
      date,
      description: transferDesc || `Transfer from ${getAccountName(transferFrom)} to ${getAccountName(transferTo)}`,
      lines: [
        { accountId: transferFrom, amount: -amount },
        { accountId: transferTo, amount: amount }
      ]
    }
    
    try {
      if (doubleEntry) {
        await db.addTransaction(tx)
      } else {
        // In simple mode, still create a transfer as a balanced transaction
        await db.add('transactions', tx)
        // Update both account balances
        const fromAcc = await db.get<Account>('accounts', transferFrom)
        const toAcc = await db.get<Account>('accounts', transferTo)
        if (fromAcc) {
          fromAcc.balance = (fromAcc.balance || 0) - amount
          await db.put('accounts', fromAcc)
        }
        if (toAcc) {
          toAcc.balance = (toAcc.balance || 0) + amount
          await db.put('accounts', toAcc)
        }
      }
      
      setItems(await db.getAll('transactions'))
      setTransferFrom('')
      setTransferTo('')
      setTransferAmount('')
      setTransferDesc('')
      alert('✅ Transfer completed successfully!')
    } catch (e: any) {
      alert('Transfer failed: ' + e.message)
    }
  }

  function convertToRecurring(transaction: Transaction) {
    // Navigate to recurring page with transaction data in state
    navigate('/recurring', { 
      state: { 
        fromTransaction: {
          description: transaction.description,
          lines: transaction.lines,
          budgetId: transaction.budgetId
        }
      }
    })
  }

  return (
    <div className="page container">
      <h2>💸 Transactions</h2>
      {loading ? (
        <div className="card" style={{padding: 20, textAlign: 'center', color: '#6b7280'}}>Loading transactions...</div>
      ) : (
        <>
      <div className="card" style={{marginBottom:12}}>
        <h3 
          style={{marginTop: 0, marginBottom: showCreateForm ? 12 : 0, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}
          onClick={() => setShowCreateForm(!showCreateForm)}
        >
          <span>
            {editingId ? '✏️ Edit' : '➕ Create'} Transaction
            {!doubleEntry && <span style={{marginLeft: 8, fontSize: '0.875rem', color: '#6b7280'}}>(Simple Mode)</span>}
            {doubleEntry && <span style={{marginLeft: 8, fontSize: '0.875rem', color: '#6b7280'}}>(Double-Entry)</span>}
          </span>
          <span style={{fontSize: '1.2rem'}}>{showCreateForm ? '▼' : '▶'}</span>
        </h3>
        {showCreateForm && (
          <>
        <input value={desc} onChange={(e)=>setDesc(e.target.value)} placeholder="Description" />
        <input type="date" value={date} onChange={(e)=>setDate(e.target.value)} />
        <select value={budgetId} onChange={(e)=>setBudgetId(e.target.value)} style={{marginTop:8}}>
          <option value="">No budget</option>
          {budgets.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <input 
          value={tagsInput} 
          onChange={(e)=>setTagsInput(e.target.value)} 
          placeholder="Tags (comma separated, e.g., food, groceries, shopping)" 
          style={{marginTop:8}}
          list="tags-datalist"
        />
        <datalist id="tags-datalist">
          {getAllTags().map(tag => (
            <option key={tag} value={tag} />
          ))}
        </datalist>
        
        <div style={{display:'flex',gap:8,marginTop:8}}>
          <select onChange={(e)=>setLineA(s=>({...s,accountId:e.target.value}))} value={lineA.accountId||''}>
            <option value="">Select account</option>
            {accounts.map(a=> <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <input 
            placeholder={doubleEntry ? "Amount" : "Amount (+income / -expense)"} 
            type="number" 
            value={lineA.amount||''} 
            onChange={(e)=>setLineA(s=>({...s,amount: Number(e.target.value)}))} 
          />
        </div>
        
        {doubleEntry && (
          <div style={{display:'flex',gap:8,marginTop:8}}>
            <select onChange={(e)=>setLineB(s=>({...s,accountId:e.target.value}))} value={lineB.accountId||''}>
              <option value="">Select account</option>
              {accounts.map(a=> <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <input placeholder="Amount (negative)" type="number" value={lineB.amount||''} onChange={(e)=>setLineB(s=>({...s,amount: Number(e.target.value)}))} />
          </div>
        )}
        
        <button onClick={create} style={{marginTop:8}} className="button-primary">{editingId ? '💾 Update' : '➕ Create'} {doubleEntry ? 'Double-Entry Tx' : 'Transaction'}</button>
          </>
        )}
      </div>

      <div className="card" style={{marginBottom:12, background: 'linear-gradient(135deg, var(--accent-light), var(--bg-secondary))'}}>
        <h3 
          style={{marginTop: 0, marginBottom: showTransfer ? 12 : 0, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}
          onClick={() => setShowTransfer(!showTransfer)}
        >
          <span style={{display: 'flex', alignItems: 'center', gap: 8}}>
            <span style={{fontSize: '1.5rem'}}>🔄</span> Quick Transfer Between Accounts
          </span>
          <span style={{fontSize: '1.2rem'}}>{showTransfer ? '▼' : '▶'}</span>
        </h3>
        {showTransfer && (
          <>
        <p style={{color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: 0, marginBottom: 12}}>
          Transfer money from one account to another instantly
        </p>
        
        <div style={{display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, alignItems: 'center', marginBottom: 8}}>
          <select value={transferFrom} onChange={(e)=>setTransferFrom(e.target.value)}>
            <option value="">From account...</option>
            {accounts.map(a=> <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <span style={{fontSize: '1.25rem', color: 'var(--accent)'}}>→</span>
          <select value={transferTo} onChange={(e)=>setTransferTo(e.target.value)}>
            <option value="">To account...</option>
            {accounts.map(a=> <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        
        <input 
          type="number" 
          placeholder="Amount to transfer" 
          value={transferAmount} 
          onChange={(e)=>setTransferAmount(e.target.value)}
          style={{marginBottom: 8}}
          min="0"
          step="0.01"
        />
        
        <input 
          placeholder="Description (optional)" 
          value={transferDesc} 
          onChange={(e)=>setTransferDesc(e.target.value)}
          style={{marginBottom: 8}}
        />
        
        <button onClick={quickTransfer} className="button-success" style={{width: '100%'}}>
          🔄 Transfer {transferAmount && `${formatCurrency(Number(transferAmount), currency)}`}
        </button>
          </>
        )}
      </div>

      <div className="card" style={{marginBottom:12}}>
        <h3 
          style={{marginTop:0, marginBottom: showFilters ? 8 : 0, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}
          onClick={() => setShowFilters(!showFilters)}
        >
          <span>🔍 Filter & Search</span>
          <span style={{fontSize: '1.2rem'}}>{showFilters ? '▼' : '▶'}</span>
        </h3>
        {showFilters && (
          <>
        <input 
          placeholder="Search by description or date..." 
          value={searchTerm} 
          onChange={(e)=>setSearchTerm(e.target.value)}
          style={{marginBottom:8}}
        />
        <select value={filterAccount} onChange={(e)=>setFilterAccount(e.target.value)} style={{marginBottom:8}}>
          <option value="">All accounts</option>
          {accounts.map(a=> <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select value={filterTag} onChange={(e)=>setFilterTag(e.target.value)}>
          <option value="">All tags</option>
          {getAllTags().map(tag=> <option key={tag} value={tag}>{tag}</option>)}
        </select>
          </>
        )}
      </div>

      <ul className="list">
        {filteredItems.map((t) => {
          const budget = getBudgetName(t.budgetId)
          return (
          <li key={t.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 12px'}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:2,flexWrap:'wrap'}}>
                <span style={{fontSize:'0.75rem',color:'#6b7280',whiteSpace:'nowrap'}}>{t.date}</span>
                <span style={{fontSize:'0.875rem',fontWeight:500,overflow:'hidden',textOverflow:'ellipsis'}}>{t.description || 'No description'}</span>
                {budget && (
                  <span style={{padding:'1px 6px',borderRadius:3,fontSize:'0.7rem',background:'#0ea5a4',color:'white',whiteSpace:'nowrap'}}>
                    {budget.name}
                  </span>
                )}
                {t.tags && t.tags.length > 0 && t.tags.map(tag => (
                  <span key={tag} style={{padding:'1px 5px',background:'#e0e7ff',color:'#4f46e5',borderRadius:3,fontSize:'0.65rem',fontWeight:500,whiteSpace:'nowrap'}}>
                    🏷️ {tag}
                  </span>
                ))}
              </div>
              <div style={{fontSize:'0.75rem',color:'#6b7280'}}>
                {t.lines.map((l, i)=> (
                  <span key={i} style={{marginRight:8}}>
                    {getAccountName(l.accountId)}: {formatCurrency(l.amount, currency)}
                  </span>
                ))}
              </div>
            </div>
            <div style={{position: 'relative', flexShrink:0}}>
              <button 
                onClick={(e) => {
                  e.stopPropagation()
                  setOpenMenuId(openMenuId === t.id ? null : t.id)
                }}
                style={{padding:'6px 12px',fontSize:'1rem',background:'transparent',border:'none',cursor:'pointer'}}
              >
                ⋮
              </button>
              {openMenuId === t.id && (
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
                    minWidth:160,
                    zIndex:999,
                    overflow:'hidden'
                  }}>
                    <button 
                      onClick={() => {convertToRecurring(t); setOpenMenuId(null)}}
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
                      <span>🔁</span> Convert to Recurring
                    </button>
                    <button 
                      onClick={() => {startEdit(t.id); setOpenMenuId(null)}}
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
                      onClick={() => {remove(t.id); setOpenMenuId(null)}}
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
          </li>
        )
        })}
      </ul>
        </>
      )}
    </div>
  )
}
