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
  const [reconcilingAccount, setReconcilingAccount] = useState<Account | null>(null)
  const [reconcileAmount, setReconcileAmount] = useState('')

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

  async function startReconcile(acc: Account) {
    setReconcilingAccount(acc)
    setReconcileAmount(String(acc.balance ?? 0))
  }

  async function recalculateBalance(accountId: string) {
    try {
      const allTransactions = await db.getAll('transactions')
      let calculatedBalance = 0
      
      // Sum all transaction amounts for this account
      for (const tx of allTransactions) {
        for (const line of tx.lines) {
          if (line.accountId === accountId) {
            calculatedBalance += line.amount
          }
        }
      }

      // Get current account data
      const acc = await db.get<Account>('accounts', accountId)
      if (!acc) return
      
      const oldBalance = acc.balance ?? 0
      const difference = calculatedBalance - oldBalance
      
      // Show detailed confirmation dialog
      if (Math.abs(difference) < 0.01) {
        alert(`✓ Balance already correct: ${formatCurrency(calculatedBalance, currency)}`)
        return
      }
      
      const confirmMessage = `Review changes before applying:\n\nCurrent Balance: ${formatCurrency(oldBalance, currency)}\nCalculated Balance: ${formatCurrency(calculatedBalance, currency)}\nDifference: ${difference > 0 ? '+' : ''}${formatCurrency(difference, currency)}\n\nApply these changes?`
      
      const confirmed = confirm(confirmMessage)
      if (!confirmed) return
      
      // Update the account with the recalculated balance
      acc.balance = calculatedBalance
      await db.put('accounts', acc)
      setItems(await db.getAll('accounts'))
      
      alert(`✓ Balance recalculated!\nOld: ${formatCurrency(oldBalance, currency)}\nNew: ${formatCurrency(calculatedBalance, currency)}`)
    } catch (err) {
      console.error('Error recalculating balance:', err)
      alert('Error recalculating balance')
    }
  }

  async function performReconcile() {
    if (!reconcilingAccount) return
    const finalAmount = parseFloat(reconcileAmount)
    if (isNaN(finalAmount)) {
      alert('Please enter a valid amount')
      return
    }
    
    const currentBalance = reconcilingAccount.balance ?? 0
    const difference = finalAmount - currentBalance
    
    if (Math.abs(difference) < 0.01) {
      alert('✓ Balances match perfectly! No reconciliation needed.')
      setReconcilingAccount(null)
      return
    }

    // Create reconciliation transaction as income/expense with 'reconcile' tag
    const tx = {
      id: `tx:${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      description: `Reconciliation adjustment for ${reconcilingAccount.name}`,
      tags: ['reconcile'],
      lines: [
        { accountId: reconcilingAccount.id, amount: difference }
      ]
    }

    await db.add('transactions', tx)
    
    // Update account balance
    const acc = await db.get<Account>('accounts', reconcilingAccount.id)
    if (acc) {
      acc.balance = finalAmount
      await db.put('accounts', acc)
    }
    
    setItems(await db.getAll('accounts'))
    setReconcilingAccount(null)
    setReconcileAmount('')
    alert(`✓ Reconciled! ${difference > 0 ? 'Added' : 'Subtracted'} ${formatCurrency(Math.abs(difference), currency)}`)
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
                        background:'var(--bg-secondary)',
                        border:'1px solid var(--border)',
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
                            background:'var(--bg-secondary)',
                            border:'none',
                            cursor:'pointer',
                            fontSize:'0.875rem',
                            color:'var(--text)',
                            display:'flex',
                            alignItems:'center',
                            gap:8
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--accent-light)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
                        >
                          <span>✏️</span> Edit
                        </button>
                        <button 
                          onClick={() => {recalculateBalance(a.id); setOpenMenuId(null)}}
                          style={{
                            width:'100%',
                            padding:'10px 16px',
                            textAlign:'left',
                            background:'var(--bg-secondary)',
                            border:'none',
                            cursor:'pointer',
                            fontSize:'0.875rem',
                            color:'var(--text)',
                            display:'flex',
                            alignItems:'center',
                            gap:8,
                            borderTop:'1px solid var(--border)'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--accent-light)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
                        >
                          <span>🔄</span> Recalculate
                        </button>
                        <button 
                          onClick={() => {startReconcile(a); setOpenMenuId(null)}}
                          style={{
                            width:'100%',
                            padding:'10px 16px',
                            textAlign:'left',
                            background:'var(--bg-secondary)',
                            border:'none',
                            cursor:'pointer',
                            fontSize:'0.875rem',
                            color:'var(--text)',
                            display:'flex',
                            alignItems:'center',
                            gap:8,
                            borderTop:'1px solid var(--border)'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--accent-light)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
                        >
                          <span>⚖️</span> Reconcile
                        </button>
                        <button 
                          onClick={() => {remove(a.id); setOpenMenuId(null)}}
                          style={{
                            width:'100%',
                            padding:'10px 16px',
                            textAlign:'left',
                            background:'var(--bg-secondary)',
                            border:'none',
                            cursor:'pointer',
                            fontSize:'0.875rem',
                            color:'var(--danger)',
                            display:'flex',
                            alignItems:'center',
                            gap:8,
                            borderTop:'1px solid var(--border)'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--accent-light)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
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

      {/* Reconcile Modal */}
      {reconcilingAccount && (
        <>
          <div 
            style={{
              position:'fixed',
              top:0,
              left:0,
              right:0,
              bottom:0,
              background:'rgba(0,0,0,0.5)',
              zIndex:1000,
              display:'flex',
              alignItems:'center',
              justifyContent:'center'
            }}
            onClick={() => setReconcilingAccount(null)}
          />
          <div 
            style={{
              position:'fixed',
              top:'50%',
              left:'50%',
              transform:'translate(-50%, -50%)',
              background:'var(--bg-secondary)',
              borderRadius:12,
              padding:24,
              boxShadow:'0 8px 16px rgba(0,0,0,0.2)',
              zIndex:1001,
              width:'90%',
              maxWidth:420
            }}
          >
            <h3 style={{marginTop:0, marginBottom:16, fontSize:'1.25rem', fontWeight: 600}}>⚖️ Reconcile Account</h3>
            
            <div style={{marginBottom:16, padding:12, background:'var(--accent-light)', borderRadius:6, border:'1px solid var(--accent)'}}>
              <div style={{fontSize:'0.75rem', fontWeight: 600, color:'#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom:4}}>Account</div>
              <div style={{fontWeight:600, fontSize: '1rem', marginBottom: 12}}>{reconcilingAccount.name}</div>
              
              <div style={{fontSize:'0.75rem', fontWeight: 600, color:'#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom:4}}>Current Balance (from transactions)</div>
              <div style={{fontSize:'1.25rem', fontWeight:700, color:'var(--text)'}}>
                {formatCurrency(reconcilingAccount.balance ?? 0, currency)}
              </div>
            </div>

            <div style={{marginBottom:16}}>
              <label style={{display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: 8}}>
                Expected Balance (from statement/bank)
              </label>
              <input 
                type="number" 
                step="0.01"
                value={reconcileAmount} 
                onChange={(e) => setReconcileAmount(e.target.value)}
                placeholder="Enter the balance you see in your statement"
                autoFocus
                style={{width: '100%'}}
              />
            </div>

            {reconcileAmount && !isNaN(parseFloat(reconcileAmount)) && (
              <div style={{
                marginBottom:16,
                padding:12,
                background:parseFloat(reconcileAmount) - (reconcilingAccount.balance ?? 0) >= 0 ? '#d1fae5' : '#fee2e2',
                border: parseFloat(reconcileAmount) - (reconcilingAccount.balance ?? 0) >= 0 ? '1px solid #a7f3d0' : '1px solid #fecaca',
                borderRadius:6
              }}>
                <div style={{fontSize:'0.75rem', fontWeight:600, color:'#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom:4}}>
                  Discrepancy
                </div>
                <div style={{fontSize:'1.25rem', fontWeight:700, color:parseFloat(reconcileAmount) - (reconcilingAccount.balance ?? 0) >= 0 ? '#059669' : '#dc2626'}}>
                  {parseFloat(reconcileAmount) - (reconcilingAccount.balance ?? 0) >= 0 ? '+' : ''}{formatCurrency(parseFloat(reconcileAmount) - (reconcilingAccount.balance ?? 0), currency)}
                </div>
                <div style={{fontSize:'0.75rem', marginTop:8, color:'#6b7280', lineHeight: '1.5'}}>
                  A reconciliation transaction will be created to adjust your balance by this amount.
                </div>
              </div>
            )}

            <div style={{display:'flex', gap:8}}>
              <button 
                onClick={performReconcile}
                className="button-success"
                style={{flex:1}}
              >
                ✓ Reconcile
              </button>
              <button 
                onClick={() => setReconcilingAccount(null)}
                className="button-secondary"
                style={{flex:1}}
              >
                ✗ Cancel
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
