import React, { useEffect, useState } from 'react'
import { WithContext as ReactTags, Tag } from 'react-tag-input'
import { useLocation } from 'react-router-dom'
import { db, RecurringTransaction, Account } from '../db/indexeddb'
import { formatCurrency } from '../utils/currency'
import { getAllTagsFromItems } from '../utils/tags'

export default function RecurringTransactionsPage() {
  const location = useLocation()
  const [items, setItems] = useState<RecurringTransaction[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [currency, setCurrency] = useState('USD')
  
  // Form state
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState<Tag[]>([])
  const [tagInputValue, setTagInputValue] = useState('')

  function addTagsFromInput() {
    // Read from controlled state or fall back to DOM input used by ReactTags
    const domInput = document.querySelector('.ReactTags__tagInputField') as HTMLInputElement | null
    const raw = (tagInputValue && tagInputValue.length > 0) ? tagInputValue : (domInput ? domInput.value : '')
    const v = (raw || '').trim()
    if (!v) return
    const parts = v.split(/[ ,]+/).map(s => s.trim()).filter(Boolean)
    if (parts.length > 0) {
      setTags(prev => [...prev, ...parts.map(p => ({ id: String(Date.now() + Math.random()), text: p }))])
    }
    setTagInputValue('')
    if (domInput) domInput.value = ''
  }
  const [frequency, setFrequency] = useState<RecurringTransaction['frequency']>('monthly')
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [endDate, setEndDate] = useState('')
  const [lineA, setLineA] = useState<{accountId?: string; amount?: number}>({})
  const [lineB, setLineB] = useState<{accountId?: string; amount?: number}>({})
  const [editingId, setEditingId] = useState<string | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [doubleEntry, setDoubleEntry] = useState(true)

  useEffect(() => {
    loadData()
    
    // Pre-fill form if coming from transaction conversion
    const state = location.state as any
    if (state?.fromTransaction) {
      const { description: desc, lines } = state.fromTransaction
      setDescription(desc || '')
      if (lines && lines.length >= 2) {
        setLineA({ accountId: lines[0].accountId, amount: lines[0].amount })
        setLineB({ accountId: lines[1].accountId, amount: lines[1].amount })
      }
    }
  }, [])

  const [tagSuggestions, setTagSuggestions] = useState<string[]>([])
  useEffect(() => {
    let mounted = true
    db.getAll('transactions').then((txs: any[]) => {
      if (mounted) setTagSuggestions(getAllTagsFromItems(txs))
    })
    return () => { mounted = false }
  }, [])

  async function loadData() {
    const [recurring, accs, curr, mode] = await Promise.all([
      db.getAll<RecurringTransaction>('recurringTransactions'),
      db.getAll<Account>('accounts'),
      db.getMeta<string>('currency'),
      db.getMeta<boolean>('doubleEntry')
    ])
    setItems(recurring)
    setAccounts(accs)
    setCurrency(curr || 'USD')
    setDoubleEntry(mode !== false)
    setLoading(false)
  }

  async function create() {
    if (!description || !lineA.accountId) {
      alert('Please fill all required fields')
      return
    }

    const aAmt = Number(lineA.amount || 0)
    
    if (doubleEntry) {
      if (!lineB.accountId) {
        alert('Please select second account for double-entry mode')
        return
      }
      const bAmt = Number(lineB.amount || 0)
      if (Math.abs(aAmt + bAmt) > 1e-6) {
        alert('Transaction must balance (sum of lines = 0)')
        return
      }
    }

    const recurring: RecurringTransaction = {
      id: editingId || `rec:${Date.now()}`,
      description,
      frequency,
      startDate,
      endDate: endDate || undefined,
      tags: tags.length > 0 ? tags.map(t => t.text) : undefined,
      lines: doubleEntry && lineB.accountId
        ? [
            { accountId: lineA.accountId!, amount: aAmt },
            { accountId: lineB.accountId!, amount: Number(lineB.amount || 0) }
          ]
        : [{ accountId: lineA.accountId!, amount: aAmt }],
      active: true
    }

    await db.put('recurringTransactions', recurring)
    await loadData()
    resetForm()
  }

  function resetForm() {
    setDescription('')
    setTags([])
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
    setTags(r.tags ? r.tags.map((t, i) => ({ id: String(i), text: t })) : [])
    setFrequency(r.frequency)
    setStartDate(r.startDate)
    setEndDate(r.endDate || '')
    setLineA({ accountId: r.lines[0]?.accountId, amount: r.lines[0]?.amount })
    if (r.lines[1]) {
      setLineB({ accountId: r.lines[1]?.accountId, amount: r.lines[1]?.amount })
    }
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
            <h3 style={{marginTop: 0, marginBottom: 12, fontSize: '1rem'}}>
              {editingId ? '✏️ Edit' : '➕ Create'} Recurring Transaction
              {!doubleEntry && <span style={{marginLeft: 8, fontSize: '0.75rem', color: '#6b7280', display: 'inline-block'}}>(Simple Mode)</span>}
              {doubleEntry && <span style={{marginLeft: 8, fontSize: '0.75rem', color: '#6b7280', display: 'inline-block'}}>(Double-Entry)</span>}
            </h3>
            
            <input 
              placeholder="Description" 
              value={description} 
              onChange={(e) => setDescription(e.target.value)}
              style={{marginBottom: 8, width: '100%'}}
            />
            <div style={{marginTop:8, display:'flex', alignItems:'flex-start', gap:8}}>
              <div style={{flex:1}}>
                <ReactTags
                  tags={tags}
                  handleDelete={(i: number) => setTags(tags.filter((tag, index) => index !== i))}
                  handleAddition={(tag: Tag) => setTags([...tags, tag])}
                  suggestions={tagSuggestions.map((t, idx) => ({ id: String(idx), text: t }))}
                  placeholder="Add tag (press Enter)"
                  autofocus={false}
                  allowDragDrop={false}
                  inputFieldPosition="top"
                  inputAttributes={{
                    value: tagInputValue,
                    onChange: (e: any) => setTagInputValue(e.target.value),
                    onBlur: (e: any) => {
                      const v = e.target.value.trim()
                      if (v) {
                        const parts = v.split(/[ ,]+/).map(s => s.trim()).filter(Boolean)
                        if (parts.length > 0) setTags(prev => [...prev, ...parts.map(p => ({ id: String(Date.now() + Math.random()), text: p }))])
                      }
                      setTagInputValue('')
                    }
                  }}
                />
              </div>
              <div style={{display:'flex',alignItems:'center'}}>
                <button onClick={addTagsFromInput} className="button-primary" style={{height:36,display:'flex',alignItems:'center',gap:8}}>➕ Add tag</button>
              </div>
            </div>
            
            <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, marginBottom: 8}}>
              <select value={frequency} onChange={(e) => setFrequency(e.target.value as any)} style={{width: '100%'}}>
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
                style={{width: '100%'}}
              />
              
              <input 
                type="date" 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)}
                placeholder="End date (optional)"
                style={{width: '100%'}}
              />
            </div>

            <div style={{marginBottom: 8}}>
              <label style={{display: 'block', fontSize: '0.75rem', color: '#6b7280', marginBottom: 4}}>
                {doubleEntry ? 'Line 1 (Debit)' : 'Account & Amount'}
              </label>
              <div style={{display: 'grid', gridTemplateColumns: '1fr 120px', gap: 8}}>
                <select 
                  onChange={(e) => setLineA(s => ({...s, accountId: e.target.value}))} 
                  value={lineA.accountId || ''}
                  style={{width: '100%'}}
                >
                  <option value="">Select account</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                <input 
                  placeholder="Amount" 
                  type="number" 
                  value={lineA.amount || ''} 
                  onChange={(e) => setLineA(s => ({...s, amount: Number(e.target.value)}))}
                  style={{width: '100%'}}
                />
              </div>
            </div>

            {doubleEntry && (
              <div style={{marginBottom: 12}}>
                <label style={{display: 'block', fontSize: '0.75rem', color: '#6b7280', marginBottom: 4}}>
                  Line 2 (Credit)
                </label>
                <div style={{display: 'grid', gridTemplateColumns: '1fr 120px', gap: 8}}>
                  <select 
                    onChange={(e) => setLineB(s => ({...s, accountId: e.target.value}))} 
                    value={lineB.accountId || ''}
                    style={{width: '100%'}}
                  >
                    <option value="">Select account</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                  <input 
                    placeholder="Amount" 
                    type="number" 
                    value={lineB.amount || ''} 
                    onChange={(e) => setLineB(s => ({...s, amount: Number(e.target.value)}))}
                    style={{width: '100%'}}
                  />
                </div>
              </div>
            )}

            <div style={{display: 'flex', gap: 8, flexWrap: 'wrap'}}>
              <button onClick={create} className="button-primary" style={{flex: '1', minWidth: '120px'}}>{editingId ? '💾 Update' : '➕ Create'}</button>
              {editingId && <button onClick={resetForm} className="button-secondary" style={{flex: '1', minWidth: '120px'}}>❌ Cancel</button>}
            </div>
          </div>

          <div style={{marginBottom: 12}}>
            <button onClick={processNow} className="button-success" style={{width: '100%'}}>
              ▶️ Process Due Transactions Now
            </button>
          </div>

          <ul className="list">
            {items.map((r) => (
              <li key={r.id} style={{padding:'8px 12px',opacity: r.active ? 1 : 0.5}}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                  <div style={{flex: 1, minWidth: 0}}>
                    <div style={{fontSize:'0.875rem',fontWeight:500,marginBottom:2}}>
                      {r.description}
                      {!r.active && <span style={{color: '#ef4444', marginLeft: 8, fontSize:'0.75rem'}}>(Inactive)</span>}
                    </div>
                    <div style={{fontSize: '0.75rem', color: '#6b7280'}}>
                      <div>{r.frequency} • Start: {r.startDate} {r.endDate && `• End: ${r.endDate}`}</div>
                      {r.lastProcessed && <div>Last: {r.lastProcessed}</div>}
                      <div style={{marginTop: 2}}>
                        {r.lines.map((l, i) => (
                          <span key={i} style={{marginRight: 12}}>
                            {getAccountName(l.accountId)}: {formatCurrency(l.amount, currency)}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div style={{position:'relative',flexShrink:0}}>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation()
                        setOpenMenuId(openMenuId === r.id ? null : r.id)
                      }}
                      style={{padding:'6px 12px',fontSize:'1rem',background:'transparent',border:'none',cursor:'pointer'}}
                    >
                      ⋮
                    </button>
                    {openMenuId === r.id && (
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
                          minWidth:160,
                          zIndex:999,
                          overflow:'hidden'
                        }}>
                          <button 
                            onClick={() => {toggleActive(r.id); setOpenMenuId(null)}}
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
                            <span>{r.active ? '⏸️' : '▶️'}</span> {r.active ? 'Pause' : 'Activate'}
                          </button>
                          <button 
                            onClick={() => {startEdit(r); setOpenMenuId(null)}}
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
                            onClick={() => {remove(r.id); setOpenMenuId(null)}}
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
