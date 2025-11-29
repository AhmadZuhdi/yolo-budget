import React, { useEffect, useState } from 'react'
import { db, RecurringTransaction, Account } from '../db/indexeddb'
import { formatCurrency } from '../utils/currency'

export default function RecurringTransactionsPage() {
  const [items, setItems] = useState<RecurringTransaction[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [currency, setCurrency] = useState('USD')
  
  // Form state
  const [description, setDescription] = useState('')
  const [frequency, setFrequency] = useState<RecurringTransaction['frequency']>('monthly')
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [endDate, setEndDate] = useState('')
  const [lineA, setLineA] = useState<{accountId?: string; amount?: number}>({})
  const [lineB, setLineB] = useState<{accountId?: string; amount?: number}>({})
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const [recurring, accs, curr] = await Promise.all([
      db.getAll<RecurringTransaction>('recurringTransactions'),
      db.getAll<Account>('accounts'),
      db.getMeta<string>('currency')
    ])
    setItems(recurring)
    setAccounts(accs)
    setCurrency(curr || 'USD')
    setLoading(false)
  }

  async function create() {
    if (!description || !lineA.accountId || !lineB.accountId) {
      alert('Please fill all fields')
      return
    }

    const aAmt = Number(lineA.amount || 0)
    const bAmt = Number(lineB.amount || 0)
    
    if (Math.abs(aAmt + bAmt) > 1e-6) {
      alert('Transaction must balance (sum of lines = 0)')
      return
    }

    const recurring: RecurringTransaction = {
      id: editingId || `rec:${Date.now()}`,
      description,
      frequency,
      startDate,
      endDate: endDate || undefined,
      lines: [
        { accountId: lineA.accountId!, amount: aAmt },
        { accountId: lineB.accountId!, amount: bAmt }
      ],
      active: true
    }

    await db.put('recurringTransactions', recurring)
    await loadData()
    resetForm()
  }

  function resetForm() {
    setDescription('')
    setFrequency('monthly')
    setStartDate(new Date().toISOString().slice(0, 10))
    setEndDate('')
    setLineA({})
    setLineB({})
    setEditingId(null)
  }

  function startEdit(r: RecurringTransaction) {
    setEditingId(r.id)
    setDescription(r.description)
    setFrequency(r.frequency)
    setStartDate(r.startDate)
    setEndDate(r.endDate || '')
    setLineA({ accountId: r.lines[0]?.accountId, amount: r.lines[0]?.amount })
    setLineB({ accountId: r.lines[1]?.accountId, amount: r.lines[1]?.amount })
  }

  async function toggleActive(id: string) {
    const item = await db.get<RecurringTransaction>('recurringTransactions', id)
    if (!item) return
    item.active = !item.active
    await db.put('recurringTransactions', item)
    await loadData()
  }

  async function remove(id: string) {
    if (!confirm('Delete recurring transaction?')) return
    await db.delete('recurringTransactions', id)
    await loadData()
  }

  async function processNow() {
    await db.processRecurringTransactions()
    alert('Recurring transactions processed!')
    await loadData()
  }

  const getAccountName = (accountId: string) => {
    return accounts.find(a => a.id === accountId)?.name || accountId
  }

  return (
    <div className="page container">
      <h2>🔁 Recurring Transactions</h2>
      
      {loading ? (
        <div className="card" style={{padding: 20, textAlign: 'center', color: '#6b7280'}}>
          Loading recurring transactions...
        </div>
      ) : (
        <>
          <div className="card" style={{marginBottom: 12}}>
            <h3 style={{marginTop: 0, marginBottom: 12}}>
              {editingId ? '✏️ Edit' : '➕ Create'} Recurring Transaction
            </h3>
            
            <input 
              placeholder="Description" 
              value={description} 
              onChange={(e) => setDescription(e.target.value)}
              style={{marginBottom: 8}}
            />
            
            <div style={{display: 'flex', gap: 8, marginBottom: 8}}>
              <select value={frequency} onChange={(e) => setFrequency(e.target.value as any)}>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
              
              <input 
                type="date" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)}
                placeholder="Start date"
              />
              
              <input 
                type="date" 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)}
                placeholder="End date (optional)"
              />
            </div>

            <div style={{marginBottom: 8}}>
              <label style={{display: 'block', fontSize: '0.875rem', color: '#6b7280', marginBottom: 4}}>
                Line 1 (Debit)
              </label>
              <div style={{display: 'flex', gap: 8}}>
                <select 
                  onChange={(e) => setLineA(s => ({...s, accountId: e.target.value}))} 
                  value={lineA.accountId || ''}
                >
                  <option value="">Select account</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                <input 
                  placeholder="Amount" 
                  type="number" 
                  value={lineA.amount || ''} 
                  onChange={(e) => setLineA(s => ({...s, amount: Number(e.target.value)}))} 
                />
              </div>
            </div>

            <div style={{marginBottom: 12}}>
              <label style={{display: 'block', fontSize: '0.875rem', color: '#6b7280', marginBottom: 4}}>
                Line 2 (Credit)
              </label>
              <div style={{display: 'flex', gap: 8}}>
                <select 
                  onChange={(e) => setLineB(s => ({...s, accountId: e.target.value}))} 
                  value={lineB.accountId || ''}
                >
                  <option value="">Select account</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                <input 
                  placeholder="Amount (negative)" 
                  type="number" 
                  value={lineB.amount || ''} 
                  onChange={(e) => setLineB(s => ({...s, amount: Number(e.target.value)}))} 
                />
              </div>
            </div>

            <div style={{display: 'flex', gap: 8}}>
              <button onClick={create} className="button-primary">{editingId ? '💾 Update' : '➕ Create'}</button>
              {editingId && <button onClick={resetForm} className="button-secondary">❌ Cancel</button>}
            </div>
          </div>

          <div style={{marginBottom: 12, textAlign: 'right'}}>
            <button onClick={processNow} className="button-success">
              ▶️ Process Due Transactions Now
            </button>
          </div>

          <ul className="list">
            {items.map((r) => (
              <li key={r.id} style={{opacity: r.active ? 1 : 0.5}}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'start'}}>
                  <div style={{flex: 1}}>
                    <div style={{fontWeight: 500, marginBottom: 4}}>
                      {r.description}
                      {!r.active && <span style={{color: '#ef4444', marginLeft: 8}}>(Inactive)</span>}
                    </div>
                    <div style={{fontSize: '0.875rem', color: '#6b7280'}}>
                      <div>Frequency: {r.frequency}</div>
                      <div>Start: {r.startDate} {r.endDate && `• End: ${r.endDate}`}</div>
                      {r.lastProcessed && <div>Last processed: {r.lastProcessed}</div>}
                      <div style={{marginTop: 4}}>
                        {r.lines.map((l, i) => (
                          <span key={i} style={{marginRight: 12}}>
                            {getAccountName(l.accountId)}: {formatCurrency(l.amount, currency)}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div style={{display: 'flex', gap: 8, flexShrink: 0}}>
                    <button onClick={() => toggleActive(r.id)} className="button-secondary">
                      {r.active ? '⏸️ Pause' : '▶️ Activate'}
                    </button>
                    <button onClick={() => startEdit(r)} className="button-primary">✏️ Edit</button>
                    <button onClick={() => remove(r.id)} className="button-danger">🗑️ Delete</button>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {items.length === 0 && (
            <div className="card" style={{padding: 20, textAlign: 'center', color: '#6b7280'}}>
              📋 No recurring transactions yet. Create one above!
            </div>
          )}
        </>
      )}
    </div>
  )
}
