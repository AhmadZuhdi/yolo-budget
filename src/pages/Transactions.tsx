import React, { useEffect, useState } from 'react'
import { db, Transaction, TransactionLine, Account, Budget } from '../db/indexeddb'
import { formatCurrency } from '../utils/currency'

export default function TransactionsPage() {
  const [items, setItems] = useState<Transaction[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [desc, setDesc] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0,10))
  const [budgetId, setBudgetId] = useState('')
  const [lineA, setLineA] = useState<{accountId?:string;amount?:number}>({})
  const [lineB, setLineB] = useState<{accountId?:string;amount?:number}>({})
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [currency, setCurrency] = useState('USD')
  const [doubleEntry, setDoubleEntry] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterAccount, setFilterAccount] = useState('')


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

  const filteredItems = items.filter(t => {
    const matchesSearch = !searchTerm || 
      t.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.date.includes(searchTerm)
    const matchesAccount = !filterAccount ||
      t.lines.some(l => l.accountId === filterAccount)
    return matchesSearch && matchesAccount
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

  return (
    <div className="page container">
      <h2>💸 Transactions</h2>
      {loading ? (
        <div className="card" style={{padding: 20, textAlign: 'center', color: '#6b7280'}}>Loading transactions...</div>
      ) : (
        <>
      <div className="card" style={{marginBottom:12}}>
        <h3 style={{marginTop: 0, marginBottom: 12}}>
          {editingId ? '✏️ Edit' : '➕ Create'} Transaction
          {!doubleEntry && <span style={{marginLeft: 8, fontSize: '0.875rem', color: '#6b7280'}}>(Simple Mode)</span>}
          {doubleEntry && <span style={{marginLeft: 8, fontSize: '0.875rem', color: '#6b7280'}}>(Double-Entry)</span>}
        </h3>
        <input value={desc} onChange={(e)=>setDesc(e.target.value)} placeholder="Description" />
        <input type="date" value={date} onChange={(e)=>setDate(e.target.value)} />
        <select value={budgetId} onChange={(e)=>setBudgetId(e.target.value)} style={{marginTop:8}}>
          <option value="">No budget</option>
          {budgets.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        
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
      </div>

      <div className="card" style={{marginBottom:12}}>
        <h3 style={{marginTop:0,marginBottom:8}}>🔍 Filter & Search</h3>
        <input 
          placeholder="Search by description or date..." 
          value={searchTerm} 
          onChange={(e)=>setSearchTerm(e.target.value)}
          style={{marginBottom:8}}
        />
        <select value={filterAccount} onChange={(e)=>setFilterAccount(e.target.value)}>
          <option value="">All accounts</option>
          {accounts.map(a=> <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>

      <ul className="list">
        {filteredItems.map((t) => {
          const budget = getBudgetName(t.budgetId)
          return (
          <li key={t.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div>
              <div style={{fontWeight:500}}>
                {t.date} — {t.description || 'No description'}
                {budget && (
                  <span 
                    style={{
                      marginLeft: 8,
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontSize: '0.75rem',
                      background: '#0ea5a4',
                      color: 'white'
                    }}
                  >
                    {budget.name}
                  </span>
                )}
              </div>
              <div style={{fontSize:'0.875rem',color:'#6b7280',marginTop:4}}>
                {t.lines.map((l, i)=> (
                  <span key={i} style={{marginRight:12}}>
                    {getAccountName(l.accountId)}: {formatCurrency(l.amount, currency)}
                  </span>
                ))}
              </div>
            </div>
            <div style={{display:'flex',gap:8}}>
              <button onClick={()=>startEdit(t.id)} className="button-primary">✏️ Edit</button>
              <button onClick={()=>remove(t.id)} className="button-danger">🗑️ Delete</button>
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
