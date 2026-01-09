import React, { useEffect, useState } from 'react'
import { WithContext as ReactTags, Tag } from 'react-tag-input'
import { useLocation } from 'react-router-dom'
import { db, RecurringTransaction, Account, Budget } from '../db/indexeddb'
import { formatCurrency } from '../utils/currency'
import { getAllTagsFromItems } from '../utils/tags'

export default function RecurringTransactionsPage() {
  const location = useLocation()
  const [items, setItems] = useState<RecurringTransaction[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [loading, setLoading] = useState(true)
  const [currency, setCurrency] = useState('USD')
  
  // Form state
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState<Tag[]>([])
  const [tagInputValue, setTagInputValue] = useState('')
  const [budgetId, setBudgetId] = useState('')

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
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640)
  const [isTransfer, setIsTransfer] = useState(false)
  const [transferFee, setTransferFee] = useState('')
  const [transferFeeAccount, setTransferFeeAccount] = useState('')

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

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
    const [recurring, accs, buds, curr] = await Promise.all([
      db.getAll<RecurringTransaction>('recurringTransactions'),
      db.getAll<Account>('accounts'),
      db.getAll<Budget>('budgets'),
      db.getMeta<string>('currency')
    ])
    setItems(recurring)
    setAccounts(accs)
    setBudgets(buds)
    setCurrency(curr || 'USD')
    setLoading(false)
  }

  async function create() {
    if (!description || !lineA.accountId) {
      alert('Please fill all required fields')
      return
    }

    const aAmt = Number(lineA.amount || 0)
    
    if (isTransfer) {
      // Transfer mode validation
      if (!lineB.accountId) {
        alert('Please select destination account for transfer')
        return
      }
      const fee = Number(transferFee || 0)
      if (fee > 0 && !transferFeeAccount) {
        alert('Please select which account to charge the fee to')
        return
      }
      
      // Create transfer with up to 3 lines
      const lines: typeof lineA[] = [
        { accountId: lineA.accountId, amount: -aAmt },
        { accountId: lineB.accountId, amount: aAmt }
      ]
      if (fee > 0) {
        lines.push({ accountId: transferFeeAccount, amount: -fee })
      }

      const recurring: RecurringTransaction = {
        id: editingId || `rec:${Date.now()}`,
        description,
        frequency,
        startDate,
        endDate: endDate || undefined,
        budgetId: budgetId || undefined,
        tags: tags.length > 0 ? tags.map(t => t.text) : undefined,
        lines: lines as any,
        active: true
      }

      await db.put('recurringTransactions', recurring)
      await loadData()
      resetForm()
    } else {
      // Regular transaction mode
      const lines: TransactionLine[] = []
      if (lineA.accountId) lines.push({ accountId: lineA.accountId!, amount: aAmt })
      if (lineB.accountId) lines.push({ accountId: lineB.accountId!, amount: Number(lineB.amount || 0) })
      
      if (lines.length === 0) {
        alert('Please select at least one account')
        return
      }

      const recurring: RecurringTransaction = {
        id: editingId || `rec:${Date.now()}`,
        description,
        frequency,
        startDate,
        endDate: endDate || undefined,
        budgetId: budgetId || undefined,
        tags: tags.length > 0 ? tags.map(t => t.text) : undefined,
        lines: lines,
        active: true
      }

      await db.put('recurringTransactions', recurring)
      await loadData()
      resetForm()
    }
  }

  function resetForm() {
    setDescription('')
    setTags([])
    setFrequency('monthly')
    setStartDate(new Date().toISOString().slice(0, 10))
    setEndDate('')
    setBudgetId('')
    setLineA({})
    setLineB({})
    setTransferFee('')
    setTransferFeeAccount('')
    setIsTransfer(false)
    setEditingId(null)
  }

  function startEdit(r: RecurringTransaction) {
    setEditingId(r.id)
    setDescription(r.description)
    setTags(r.tags ? r.tags.map((t, i) => ({ id: String(i), text: t })) : [])
    setFrequency(r.frequency)
    setStartDate(r.startDate)
    setEndDate(r.endDate || '')
    setBudgetId(r.budgetId || '')
    setLineA({ accountId: r.lines[0]?.accountId, amount: r.lines[0]?.amount })
    if (r.lines[1]) {
      setLineB({ accountId: r.lines[1]?.accountId, amount: r.lines[1]?.amount })
    }
    // Check if it's a transfer (has negative amount in first line)
    if (r.lines.length >= 2 && r.lines[0]?.amount && r.lines[0].amount < 0) {
      setIsTransfer(true)
    }
    if (r.lines[2]) {
      // Fee transfer (3 lines)
      setTransferFeeAccount(r.lines[2].accountId)
      setTransferFee(String(Math.abs(r.lines[2].amount)))
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
    try {
      // Get all active recurring transactions and process only those that are due
      const recurring = await db.getAll<RecurringTransaction>('recurringTransactions')
      const today = new Date().toISOString().slice(0, 10)
      let processed = 0
      let skipped = 0
      
      for (const r of recurring) {
        if (!r.active) continue
        
        // Check if this recurring transaction should be processed
        const lastProcessed = r.lastProcessed || r.startDate
        const shouldProcess = db.shouldProcess(lastProcessed, today, r.frequency)
        
        if (!shouldProcess) {
          console.log(`[processNow] Skipping "${r.description}" - not due yet (last: ${lastProcessed}, freq: ${r.frequency})`)
          skipped++
          continue
        }
        
        try {
          await db.processRecurringTransaction(r.id)
          processed++
        } catch (err) {
          console.error(`Failed to process "${r.description}":`, err)
        }
      }
      
      alert(`Processed ${processed} recurring transactions${skipped > 0 ? ` (${skipped} not due yet)` : ''}! Check browser console for details.`)
      await loadData()
    } catch (err) {
      console.error('Error processing:', err)
      alert('Error processing recurring transactions. Check console.')
    }
  }

  async function processSingle(id: string) {
    try {
      const recurring = await db.get<RecurringTransaction>('recurringTransactions', id)
      if (!recurring) {
        alert('Recurring transaction not found')
        return
      }

      await db.processRecurringTransaction(id)
      alert(`Processed "${recurring.description}"! Check browser console for details.`)
      await loadData()
    } catch (err) {
      console.error('Error processing single:', err)
      alert('Error processing transaction. Check console.')
    }
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
            <h3 style={{marginTop: 0, marginBottom: 16, fontSize: '1rem'}}>
              {editingId ? '✏️ Edit' : '➕ Create'} Recurring {isTransfer ? 'Transfer' : 'Transaction'}
              {isTransfer && <span style={{marginLeft: 8, fontSize: '0.75rem', color: '#6b7280', display: 'inline-block'}}>(Transfer)</span>}
            </h3>

            <div style={{marginBottom: 12, display: 'flex', gap: 8}}>
              <button 
                onClick={() => setIsTransfer(false)}
                style={{
                  flex: 1,
                  padding: '8px 16px',
                  background: !isTransfer ? 'var(--accent)' : 'var(--bg-secondary)',
                  color: !isTransfer ? '#fff' : 'var(--text)',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 500
                }}
              >
                📝 Transaction
              </button>
              <button 
                onClick={() => setIsTransfer(true)}
                style={{
                  flex: 1,
                  padding: '8px 16px',
                  background: isTransfer ? 'var(--accent)' : 'var(--bg-secondary)',
                  color: isTransfer ? '#fff' : 'var(--text)',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 500
                }}
              >
                💸 Transfer
              </button>
            </div>
            
            <div style={{marginBottom: 12}}>
              <label style={{display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: 4}}>Description</label>
              <input 
                placeholder="e.g., Salary, Rent, Insurance" 
                value={description} 
                onChange={(e) => setDescription(e.target.value)}
                style={{marginBottom: 0, width: '100%'}}
              />
            </div>

            <div style={{marginBottom: 12}}>
              <label style={{display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: 4}}>Tags</label>
              <div style={{display:'flex', alignItems:'flex-start', gap:8}}>
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
                  <button onClick={addTagsFromInput} className="button-primary" style={{height:36,display:'flex',alignItems:'center',gap:8,whiteSpace:'nowrap'}}>➕ Add tag</button>
                </div>
              </div>
            </div>
            
            <div style={{display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 8, marginBottom: 12}}>
              <div>
                <label style={{display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: 4}}>Frequency</label>
                <select value={frequency} onChange={(e) => setFrequency(e.target.value as any)} style={{width: '100%'}}>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
              
              <div>
                <label style={{display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: 4}}>Start Date</label>
                <input 
                  type="date" 
                  value={startDate} 
                  onChange={(e) => setStartDate(e.target.value)}
                  placeholder="Start date"
                  style={{width: '100%'}}
                />
              </div>
              
              <div>
                <label style={{display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: 4}}>End Date (Optional)</label>
                <input 
                  type="date" 
                  value={endDate} 
                  onChange={(e) => setEndDate(e.target.value)}
                  placeholder="End date"
                  style={{width: '100%'}}
                />
              </div>
            </div>

            <div style={{marginBottom: 12}}>
              <label style={{display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: 4}}>Budget (Optional)</label>
              <select 
                value={budgetId} 
                onChange={(e) => setBudgetId(e.target.value)}
                style={{width: '100%'}}
              >
                <option value="">-- No Budget --</option>
                {budgets.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>

            <div style={{marginBottom: 12}}>
              <label style={{display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: 4}}>
                {isTransfer ? 'From Account' : 'Account & Amount'}
              </label>
              <div style={{display: 'grid', gridTemplateColumns: isTransfer ? '1fr' : '1fr 2fr', gap: 8}}>
                <select 
                  onChange={(e) => setLineA(s => ({...s, accountId: e.target.value}))} 
                  value={lineA.accountId || ''}
                  style={{width: '100%', boxSizing: 'border-box'}}
                >
                  <option value="">Select account</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                {!isTransfer && (
                  <input 
                    placeholder="Amount" 
                    type="number" 
                    value={lineA.amount || ''} 
                    onChange={(e) => setLineA(s => ({...s, amount: Number(e.target.value)}))} 
                    style={{width: '100%', boxSizing: 'border-box'}}
                  />
                )}
              </div>
            </div>

            {isTransfer && (
              <div style={{marginBottom: 12}}>
                <label style={{display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: 4}}>
                  {isTransfer ? 'To Account & Amount' : 'Line 2 (Credit)'}
                </label>
                <div style={{display: 'grid', gridTemplateColumns: isTransfer ? '1fr 2fr' : '1fr 2fr', gap: 8}}>
                  <select 
                    onChange={(e) => setLineB(s => ({...s, accountId: e.target.value}))} 
                    value={lineB.accountId || ''}
                    style={{width: '100%', boxSizing: 'border-box'}}
                  >
                    <option value="">Select account</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                  <input 
                    placeholder="Amount" 
                    type="number" 
                    value={lineB.amount || ''} 
                    onChange={(e) => setLineB(s => ({...s, amount: Number(e.target.value)}))} 
                    style={{width: '100%', boxSizing: 'border-box'}}
                  />
                </div>
              </div>
            )}

            {isTransfer && (
              <div style={{marginBottom: 12}}>
                <label style={{display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: 4}}>Transfer Fee (Optional)</label>
                <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8}}>
                  <input 
                    placeholder="Fee amount" 
                    type="number" 
                    value={transferFee}
                    onChange={(e) => setTransferFee(e.target.value)}
                    style={{width: '100%', boxSizing: 'border-box'}}
                  />
                  <select 
                    value={transferFeeAccount}
                    onChange={(e) => setTransferFeeAccount(e.target.value)}
                    style={{width: '100%', boxSizing: 'border-box'}}
                  >
                    <option value="">Charge to...</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                {transferFee && transferFeeAccount && (
                  <div style={{fontSize: '0.75rem', color: '#6b7280', marginTop: 4}}>
                    Fee of {formatCurrency(Number(transferFee), currency)} will be charged to {accounts.find(a => a.id === transferFeeAccount)?.name}
                  </div>
                )}
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
                      {r.budgetId && (
                        <div style={{marginTop: 4}}>
                          💰 {budgets.find(b => b.id === r.budgetId)?.name || r.budgetId}
                        </div>
                      )}
                      {r.tags && r.tags.length > 0 && (
                        <div style={{marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap'}}>
                          {r.tags.map((tag, i) => (
                            <span key={i} style={{
                              background: 'var(--accent)',
                              color: '#fff',
                              padding: '2px 8px',
                              borderRadius: 4,
                              fontSize: '0.65rem',
                              fontWeight: 500
                            }}>
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
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
                            onClick={() => {processSingle(r.id); setOpenMenuId(null)}}
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
                            <span>▶️</span> Process Now
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
