import React, { useEffect, useState } from 'react'
import { db, Account } from '../db/indexeddb'
import { formatCurrency } from '../utils/currency'

export default function AccountsPage() {
  const [items, setItems] = useState<Account[]>([])
  const [name, setName] = useState('')
  const [type, setType] = useState<Account['type']>('bank')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editType, setEditType] = useState<Account['type']>('bank')
  const [loading, setLoading] = useState(true)
  const [currency, setCurrency] = useState('USD')

  useEffect(() => {
    let mounted = true
    Promise.all([
      db.getAll<Account>('accounts'),
      db.getMeta<string>('currency')
    ]).then(([accounts, curr]) => {
      if (mounted) {
        setItems(accounts)
        setCurrency(curr || 'USD')
        setLoading(false)
      }
    })
    return () => { mounted = false }
  }, [])

  async function create() {
    if (!name) return
    const acc: Account = { id: `acc:${Date.now()}`, name, type, balance: 0 }
    await db.put('accounts', acc)
    setItems(await db.getAll('accounts'))
    setName('')
  }

  async function startEdit(a: Account) {
    setEditingId(a.id)
    setEditName(a.name)
    setEditType(a.type)
  }

  async function saveEdit() {
    if (!editingId) return
    const acc = await db.get<Account>('accounts', editingId)
    if (!acc) return
    acc.name = editName
    acc.type = editType
    await db.put('accounts', acc)
    setItems(await db.getAll('accounts'))
    setEditingId(null)
  }

  async function remove(id: string) {
    // Check for transactions referencing this account
    const allTx = await db.getAll('transactions')
    const referencing = allTx.filter(t => t.lines.some((l: any) => l.accountId === id))
    if (referencing.length) {
      const ok = confirm(`This account is referenced by ${referencing.length} transaction(s). Delete account and ${referencing.length} transaction(s)? OK to cascade delete, Cancel to abort.`)
      if (!ok) return
      // cascade delete transactions
      for (const tx of referencing) {
        await db.deleteTransaction(tx.id)
      }
    }
    await db.delete('accounts', id)
    setItems(await db.getAll('accounts'))
  }

  return (
    <div className="page container">
      <h2 style={{marginBottom: 24, fontSize: '1.75rem', fontWeight: 700}}>🏛️ Accounts</h2>
      {loading ? (
        <div className="card" style={{padding: 40, textAlign: 'center', color: '#6b7280'}}>
          <div style={{fontSize: '2rem', marginBottom: 8}}>⏳</div>
          Loading accounts...
        </div>
      ) : (
        <>
      <div className="card" style={{marginBottom: 20}}>
        <h3 style={{marginTop: 0, marginBottom: 16}}>Add New Account</h3>
        <div style={{display: 'grid', gap: 12}}>
          <div>
            <label>Account Name</label>
            <input placeholder="e.g., Main Checking, Savings" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label>Account Type</label>
            <select value={type} onChange={(e) => setType(e.target.value as any)}>
              <option value="bank">🏦 Bank</option>
              <option value="cash">💵 Cash</option>
              <option value="credit">💳 Credit</option>
              <option value="other">💼 Other</option>
            </select>
          </div>
          <button onClick={create} style={{marginTop: 8}}>➕ Add Account</button>
        </div>
      </div>
      <div className="card">
        <h3 style={{marginTop: 0, marginBottom: 16}}>Your Accounts ({items.length})</h3>
        {items.length === 0 ? (
          <div style={{padding: 40, textAlign: 'center', color: '#6b7280'}}>
            <div style={{fontSize: '3rem', marginBottom: 8}}>🏦</div>
            <p>No accounts yet. Add your first account above!</p>
          </div>
        ) : (
      <ul className="list">
        {items.map((a) => (
          <li key={a.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center', padding: '16px 0'}}>
            <div style={{flex: 1}}>
              {editingId === a.id ? (
                <div style={{display: 'grid', gap: 8}}>
                  <input value={editName} onChange={(e)=>setEditName(e.target.value)} placeholder="Account name" />
                  <select value={editType} onChange={(e)=>setEditType(e.target.value as any)}>
                    <option value="bank">🏪 Bank</option>
                    <option value="cash">💵 Cash</option>
                    <option value="credit">💳 Credit</option>
                    <option value="other">💼 Other</option>
                  </select>
                </div>
              ) : (
                <div>
                  <div style={{fontWeight: 600, fontSize: '1rem', marginBottom: 4}}>{a.name}</div>
                  <div style={{fontSize: '0.875rem', color: '#6b7280'}}>
                    {a.type.charAt(0).toUpperCase() + a.type.slice(1)} • {formatCurrency(a.balance ?? 0, currency)}
                  </div>
                </div>
              )}
            </div>
            <div style={{display:'flex',gap:8, flexShrink: 0}}>
              {editingId === a.id ? (
                <>
                  <button onClick={saveEdit} style={{background: '#10b981'}}>✓ Save</button>
                  <button onClick={()=>setEditingId(null)} style={{background: '#6b7280'}}>✗ Cancel</button>
                </>
              ) : (
                <>
                  <button onClick={()=>startEdit(a)} style={{background: '#3b82f6'}}>✏️ Edit</button>
                  <button onClick={()=>remove(a.id)} style={{background: '#ef4444'}}>🗑️ Delete</button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
        )}
      </div>
        </>
      )}
    </div>
  )
}
