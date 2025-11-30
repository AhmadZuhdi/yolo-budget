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
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

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
          <li key={a.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 12px'}}>
            <div style={{flex:1,minWidth:0}}>
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
                  <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:2}}>
                    <span style={{fontSize:'0.875rem',fontWeight:500}}>{a.name}</span>
                    <span style={{padding:'1px 6px',borderRadius:3,fontSize:'0.7rem',background:'#e0e7ff',color:'#4f46e5'}}>
                      {a.type}
                    </span>
                  </div>
                  <div style={{fontSize:'0.75rem',color:'#6b7280'}}>
                    {formatCurrency(a.balance ?? 0, currency)}
                  </div>
                </div>
              )}
            </div>
            <div style={{position:'relative',flexShrink:0}}>
              {editingId === a.id ? (
                <div style={{display:'flex',gap:4}}>
                  <button onClick={saveEdit} style={{padding:'6px 12px',fontSize:'0.8rem',background:'#10b981',color:'white',border:'none',borderRadius:4,cursor:'pointer'}}>✓</button>
                  <button onClick={()=>setEditingId(null)} style={{padding:'6px 12px',fontSize:'0.8rem',background:'#6b7280',color:'white',border:'none',borderRadius:4,cursor:'pointer'}}>✗</button>
                </div>
              ) : (
                <>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation()
                      setOpenMenuId(openMenuId === a.id ? null : a.id)
                    }}
                    style={{padding:'6px 12px',fontSize:'1rem',background:'transparent',border:'none',cursor:'pointer'}}
                  >
                    ⋮
                  </button>
                  {openMenuId === a.id && (
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
                          onClick={() => {startEdit(a); setOpenMenuId(null)}}
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
                          onClick={() => {remove(a.id); setOpenMenuId(null)}}
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
