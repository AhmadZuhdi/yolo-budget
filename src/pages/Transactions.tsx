import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { db, Transaction, TransactionLine, Account, Budget } from '../db/indexeddb'
import { formatCurrency } from '../utils/currency'
import { getAllTagsFromItems } from '../utils/tags'
import { WithContext as ReactTags, Tag } from 'react-tag-input'

const KeyCodes = {
  comma: 188,
  enter: 13
}

const KeyCodesExtended = {
  ...KeyCodes,
  space: 32
}

const delimiters = [KeyCodesExtended.comma, KeyCodesExtended.enter, KeyCodesExtended.space]

export default function TransactionsPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState<Transaction[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [desc, setDesc] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0,10))
  const [budgetId, setBudgetId] = useState('')
  const [tags, setTags] = useState<Tag[]>([])
  const [tagInputValue, setTagInputValue] = useState('')

  function addTagsFromInput() {
    // try the controlled value first, fall back to reading the actual DOM input used by ReactTags
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
  const [lineA, setLineA] = useState<{accountId?:string;amount?:number}>({})
  const [lineB, setLineB] = useState<{accountId?:string;amount?:number}>({})
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [currency, setCurrency] = useState('USD')
  const [doubleEntry, setDoubleEntry] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterAccount, setFilterAccount] = useState('')
  const [filterTag, setFilterTag] = useState('')
  const [filterBudget, setFilterBudget] = useState('')
  
  // Collapsible sections state
  const [showCreateForm, setShowCreateForm] = useState(true)
  const [showTransfer, setShowTransfer] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card')
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 640)
  
  // Transfer state
  const [transferFrom, setTransferFrom] = useState('')
  const [transferTo, setTransferTo] = useState('')
  const [transferAmount, setTransferAmount] = useState('')
  const [transferDesc, setTransferDesc] = useState('')
  const [transferFee, setTransferFee] = useState('')
  const [transferFeeAccount, setTransferFeeAccount] = useState('')


  useEffect(() => {
    let mounted = true
    const handleResize = () => {
      if (mounted) {
        setIsMobile(window.innerWidth < 640)
      }
    }
    window.addEventListener('resize', handleResize)
    return () => {
      mounted = false
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  useEffect(() => {
    let mounted = true
    Promise.all([
      db.getAll<Transaction>('transactions'),
      db.getAll<Account>('accounts'),
      db.getMeta<string>('currency'),
      db.getAll<Budget>('budgets'),
      db.getMeta<boolean>('doubleEntry'),
      db.getMeta<string>('defaultAccountId'),
      db.getMeta<string>('defaultBudgetId'),
      db.getMeta<number>('itemsPerPage'),
      db.getMeta<number>('paginationPage')
    ]).then(([transactions, accs, curr, buds, de, defAccId, defBudId, savedItemsPerPage, savedPage]) => {
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
        // Load pagination settings
        if (savedItemsPerPage) {
          setItemsPerPage(savedItemsPerPage)
        }
        if (savedPage) {
          setCurrentPage(savedPage)
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

  // Get all unique tags from transactions (shared util)
  const getAllTags = () => getAllTagsFromItems(items)

  const filteredItems = items.filter(t => {
    const matchesSearch = !searchTerm || 
      t.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.date.includes(searchTerm)
    const matchesAccount = !filterAccount ||
      t.lines.some(l => l.accountId === filterAccount)
    const matchesTag = !filterTag ||
      (t.tags && t.tags.some(tag => tag.toLowerCase().includes(filterTag.toLowerCase())))
    const matchesBudget = !filterBudget ||
      t.budgetId === filterBudget
    return matchesSearch && matchesAccount && matchesTag && matchesBudget
  }).sort((a, b) => {
    // Sort by date descending (newest first)
    return b.date.localeCompare(a.date) || b.id.localeCompare(a.id)
  })

  // Reset to page 1 when filters change
  const [prevFilterLength, setPrevFilterLength] = useState(filteredItems.length)
  useEffect(() => {
    if (filteredItems.length !== prevFilterLength) {
      setCurrentPage(1)
      setPrevFilterLength(filteredItems.length)
    }
  }, [filteredItems.length, prevFilterLength])

  // Save pagination settings when they change
  useEffect(() => {
    db.setMeta('itemsPerPage', itemsPerPage)
  }, [itemsPerPage])

  useEffect(() => {
    db.setMeta('paginationPage', currentPage)
  }, [currentPage])

  // Pagination calculations
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedItems = filteredItems.slice(startIndex, endIndex)

  async function create() {
    if (!lineA.accountId) return
    
    const isEditing = !!editingId

    const aAmt = Number(lineA.amount || 0)
    
    // Validation: amount must not be 0
    if (aAmt === 0) {
      alert('Amount cannot be 0')
      return
    }
    
    if (doubleEntry) {
      // Double-entry mode: require both accounts and balanced transaction
      if (!lineB.accountId) {
        alert('Double-entry mode requires two accounts')
        return
      }
      const bAmt = Number(lineB.amount || 0)
      
      // Validation: amount B must not be 0
      if (bAmt === 0) {
        alert('Amount cannot be 0')
        return
      }
      
      if (Math.abs(aAmt + bAmt) > 1e-6) {
        alert('Transaction must balance (sum of lines = 0)')
        return
      }
      
      const tx: Transaction = {
        id: editingId || `tx:${Date.now()}`,
        date,
        description: desc,
        budgetId: budgetId || undefined,
        tags: tags.length > 0 ? tags.map(t => t.text) : undefined,
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
        setTags([])
        // Keep the previously selected account/budget, clear amounts
        setLineA({ accountId: lineA.accountId })
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
        tags: tags.length > 0 ? tags.map(t => t.text) : undefined,
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
        setTags([])
        // Keep the previously selected account/budget, clear amounts
        setLineA({ accountId: lineA.accountId })
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
    setTags(tx.tags ? tx.tags.map((tag, index) => ({ id: String(index), text: tag })) : [])
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

    const fee = transferFee ? Number(transferFee) : 0
    if (fee < 0) {
      alert('Transfer fee cannot be negative')
      return
    }

    // If fee is set, must select which account to charge
    if (fee > 0 && !transferFeeAccount) {
      alert('Please select which account to charge the fee to')
      return
    }
    
    try {
      // Create transfer transaction with possible fee
      const lines: TransactionLine[] = [
        { accountId: transferFrom, amount: -amount },
        { accountId: transferTo, amount: amount }
      ]

      // Add fee line if fee exists
      if (fee > 0) {
        lines.push({ accountId: transferFeeAccount, amount: -fee })
      }

      const tx: Transaction = {
        id: `tx:${Date.now()}`,
        date,
        description: transferDesc || `Transfer from ${getAccountName(transferFrom)} to ${getAccountName(transferTo)}${fee > 0 ? ` (fee: ${formatCurrency(fee, currency)})` : ''}`,
        lines: lines
      }
      
      if (doubleEntry) {
        await db.addTransaction(tx)
      } else {
        // In simple mode, still create a transfer as a balanced transaction
        await db.add('transactions', tx)
        // Update account balances
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
        if (fee > 0) {
          const feeAcc = await db.get<Account>('accounts', transferFeeAccount)
          if (feeAcc) {
            feeAcc.balance = (feeAcc.balance || 0) - fee
            await db.put('accounts', feeAcc)
          }
        }
      }
      
      setItems(await db.getAll('transactions'))
      setTransferFrom('')
      setTransferTo('')
      setTransferAmount('')
      setTransferDesc('')
      setTransferFee('')
      setTransferFeeAccount('')
      alert(`✅ Transfer completed successfully!${fee > 0 ? ` (Fee: ${formatCurrency(fee, currency)})` : ''}`)
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
        <div style={{marginTop:8, display:'flex', alignItems:'flex-start', gap:8}}>
          <div style={{flex:1}}>
            <ReactTags
            tags={tags}
            handleDelete={(i: number) => setTags(tags.filter((tag, index) => index !== i))}
            handleAddition={(tag: Tag) => setTags([...tags, tag])}
            suggestions={getAllTags().map((t, idx) => ({ id: String(idx), text: t }))}
            placeholder="Add tag (press Enter or Space)"
            delimiters={delimiters}
            autofocus={false}
            allowDragDrop={false}
            inputFieldPosition="top"
            inputAttributes={{
              value: tagInputValue,
              onChange: (e: any) => {
                setTagInputValue(e.target.value)
              },
              onBlur: (e: any) => {
                const v = e.target.value.trim()
                if (v) {
                  // may contain multiple tags separated by spaces or commas
                  const parts = v.split(/[ ,]+/).map(s => s.trim()).filter(Boolean)
                  if (parts.length > 0) {
                    setTags(prev => [...prev, ...parts.map(p => ({ id: String(Date.now() + Math.random()), text: p }))])
                  }
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

        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8}}>
          <input 
            type="number" 
            placeholder="Transfer fee (optional)" 
            value={transferFee} 
            onChange={(e)=>setTransferFee(e.target.value)}
            min="0"
            step="0.01"
          />
          <select 
            value={transferFeeAccount} 
            onChange={(e)=>setTransferFeeAccount(e.target.value)}
            disabled={!transferFee || Number(transferFee) === 0}
            style={{opacity: !transferFee || Number(transferFee) === 0 ? 0.5 : 1}}
          >
            <option value="">Charge fee to...</option>
            {accounts.map(a=> <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        
        <input 
          placeholder="Description (optional)" 
          value={transferDesc} 
          onChange={(e)=>setTransferDesc(e.target.value)}
          style={{marginBottom: 8}}
        />

        <div style={{fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 12, padding: '8px', background: 'var(--bg)', borderRadius: 4}}>
          <strong>Fee Info:</strong> If a fee is set, it will create a transaction with 3 lines:
          <ul style={{margin: '4px 0', paddingLeft: 16}}>
            <li>From account: -{formatCurrency(Number(transferAmount) || 0, currency)}</li>
            <li>To account: +{formatCurrency(Number(transferAmount) || 0, currency)}</li>
            {transferFee && Number(transferFee) > 0 && <li>Fee account: -{formatCurrency(Number(transferFee), currency)}</li>}
          </ul>
        </div>
        
        <button onClick={quickTransfer} className="button-success" style={{width: '100%'}}>
          🔄 Transfer {transferAmount && `${formatCurrency(Number(transferAmount), currency)}`}{transferFee && Number(transferFee) > 0 && ` + ${formatCurrency(Number(transferFee), currency)} fee`}
        </button>
          </>
        )}
      </div>

      <div className="card" style={{marginBottom:12}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
          <h3 
            style={{margin: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, flex: 1}}
            onClick={() => setShowFilters(!showFilters)}
          >
            <span>🔍 Filter & Search</span>
            <span style={{fontSize: '1.2rem'}}>{showFilters ? '▼' : '▶'}</span>
          </h3>
          <div style={{display:'flex',gap:4,background:'var(--bg)',borderRadius:6,padding:2}}>
            <button
              onClick={() => setViewMode('card')}
              style={{
                padding:'6px 12px',
                border:'none',
                borderRadius:4,
                cursor:'pointer',
                background: viewMode === 'card' ? 'var(--accent)' : 'transparent',
                color: viewMode === 'card' ? 'white' : 'var(--text)',
                fontSize:'0.875rem',
                fontWeight: viewMode === 'card' ? 600 : 400,
                transition:'all 0.2s'
              }}
            >
              📋 Cards
            </button>
            <button
              onClick={() => setViewMode('table')}
              style={{
                padding:'6px 12px',
                border:'none',
                borderRadius:4,
                cursor:'pointer',
                background: viewMode === 'table' ? 'var(--accent)' : 'transparent',
                color: viewMode === 'table' ? 'white' : 'var(--text)',
                fontSize:'0.875rem',
                fontWeight: viewMode === 'table' ? 600 : 400,
                transition:'all 0.2s'
              }}
            >
              📊 Table
            </button>
          </div>
        </div>
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
        <select value={filterBudget} onChange={(e)=>setFilterBudget(e.target.value)} style={{marginBottom:8}}>
          <option value="">All budgets</option>
          {budgets.map(b=> <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select value={filterTag} onChange={(e)=>setFilterTag(e.target.value)}>
          <option value="">All tags</option>
          {getAllTags().map(tag=> <option key={tag} value={tag}>{tag}</option>)}
        </select>
          </>
        )}
      </div>

      <div className="card" style={{marginBottom:12, padding:'12px'}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, flexWrap:'wrap'}}>
          <div style={{display:'flex', alignItems:'center', gap:8}}>
            <label style={{fontSize:'0.875rem', color:'var(--text-secondary)', fontWeight:500}}>Items per page:</label>
            <select 
              value={itemsPerPage} 
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value))
                setCurrentPage(1)
              }}
              style={{padding:'6px 8px', borderRadius:4, border:'1px solid var(--border)', background:'var(--bg)', color:'var(--text)', fontSize:'0.875rem'}}
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          <div style={{display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', justifyContent:'center'}}>
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              style={{
                padding:'6px 12px',
                border:'1px solid var(--border)',
                borderRadius:4,
                background:'var(--bg)',
                color:'var(--text)',
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                opacity: currentPage === 1 ? 0.5 : 1,
                fontSize:'0.875rem',
                fontWeight:500,
                transition:'all 0.2s',
                whiteSpace:'nowrap'
              }}
            >
              ← Previous
            </button>
            
            {!isMobile && totalPages > 5 ? (
              <div style={{display:'flex', gap:4, alignItems:'center', justifyContent:'center'}}>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    style={{
                      padding:'6px 10px',
                      border: currentPage === page ? '2px solid var(--accent)' : '1px solid var(--border)',
                      borderRadius:4,
                      background: currentPage === page ? 'var(--accent)' : 'var(--bg)',
                      color: currentPage === page ? 'white' : 'var(--text)',
                      cursor:'pointer',
                      fontSize:'0.875rem',
                      fontWeight: currentPage === page ? 600 : 400,
                      transition:'all 0.2s',
                      minWidth:'40px'
                    }}
                  >
                    {page}
                  </button>
                ))}
              </div>
            ) : totalPages <= 5 ? (
              <div style={{display:'flex', gap:4, alignItems:'center', justifyContent:'center'}}>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    style={{
                      padding:'6px 10px',
                      border: currentPage === page ? '2px solid var(--accent)' : '1px solid var(--border)',
                      borderRadius:4,
                      background: currentPage === page ? 'var(--accent)' : 'var(--bg)',
                      color: currentPage === page ? 'white' : 'var(--text)',
                      cursor:'pointer',
                      fontSize:'0.875rem',
                      fontWeight: currentPage === page ? 600 : 400,
                      transition:'all 0.2s',
                      minWidth:'40px'
                    }}
                  >
                    {page}
                  </button>
                ))}
              </div>
            ) : (
              <span style={{fontSize:'0.875rem', color:'var(--text)', fontWeight:500, minWidth:'fit-content'}}>
                Page {currentPage} of {totalPages}
              </span>
            )}

            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              style={{
                padding:'6px 12px',
                border:'1px solid var(--border)',
                borderRadius:4,
                background:'var(--bg)',
                color:'var(--text)',
                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                opacity: currentPage === totalPages ? 0.5 : 1,
                fontSize:'0.875rem',
                fontWeight:500,
                transition:'all 0.2s',
                whiteSpace:'nowrap'
              }}
            >
              Next →
            </button>
          </div>

          <div style={{fontSize:'0.875rem', color:'var(--text-secondary)', fontWeight:500}}>
            {filteredItems.length === 0 ? 'No transactions' : `${startIndex + 1}–${Math.min(endIndex, filteredItems.length)} of ${filteredItems.length}`}
          </div>
        </div>
      </div>

      {viewMode === 'table' ? (
        <div className="card" style={{overflowX:'auto',padding:0}}>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead>
              <tr style={{background:'var(--accent-light)',borderBottom:'2px solid var(--border)'}}>
                <th style={{padding:'12px',textAlign:'left',color:'var(--text)',fontWeight:600,fontSize:'0.875rem'}}>Date</th>
                <th style={{padding:'12px',textAlign:'left',color:'var(--text)',fontWeight:600,fontSize:'0.875rem'}}>Description</th>
                <th style={{padding:'12px',textAlign:'left',color:'var(--text)',fontWeight:600,fontSize:'0.875rem'}}>Account(s)</th>
                <th style={{padding:'12px',textAlign:'left',color:'var(--text)',fontWeight:600,fontSize:'0.875rem'}}>Budget</th>
                <th style={{padding:'12px',textAlign:'left',color:'var(--text)',fontWeight:600,fontSize:'0.875rem'}}>Tags</th>
                <th style={{padding:'12px',textAlign:'right',color:'var(--text)',fontWeight:600,fontSize:'0.875rem'}}>Amount</th>
                <th style={{padding:'12px',textAlign:'center',color:'var(--text)',fontWeight:600,fontSize:'0.875rem',width:'60px'}}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.map((t) => {
                const budget = getBudgetName(t.budgetId)
                return (
                  <tr key={t.id} style={{borderBottom:'1px solid var(--border)'}}>
                    <td style={{padding:'12px',fontSize:'0.8rem',color:'var(--text-secondary)',whiteSpace:'nowrap'}}>{t.date}</td>
                    <td style={{padding:'12px',fontSize:'0.875rem',color:'var(--text)',fontWeight:500}}>{t.description || 'No description'}</td>
                    <td style={{padding:'12px',fontSize:'0.8rem',color:'var(--text-secondary)'}}>
                      {t.lines.map((l, i) => (
                        <div key={i}>
                          {getAccountName(l.accountId)}: {formatCurrency(l.amount, currency)}
                        </div>
                      ))}
                    </td>
                    <td style={{padding:'12px',fontSize:'0.8rem'}}>
                      {budget && (
                        <span style={{padding:'2px 8px',borderRadius:4,fontSize:'0.75rem',background:'var(--accent)',color:'white',whiteSpace:'nowrap'}}>
                          {budget.name}
                        </span>
                      )}
                    </td>
                    <td style={{padding:'12px',fontSize:'0.8rem'}}>
                      {t.tags && t.tags.length > 0 && (
                        <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                          {t.tags.map(tag => (
                            <span key={tag} style={{padding:'2px 6px',background:'var(--accent-light)',color:'var(--text)',border:'1px solid var(--accent)',borderRadius:4,fontSize:'0.7rem',fontWeight:500,whiteSpace:'nowrap'}}>
                              🏷️ {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td style={{padding:'12px',fontSize:'0.875rem',color:'var(--text)',fontWeight:600,textAlign:'right',whiteSpace:'nowrap'}}>
                      {t.lines.reduce((sum, l) => sum + l.amount, 0) >= 0 ? '+' : ''}{formatCurrency(t.lines.reduce((sum, l) => sum + l.amount, 0), currency)}
                    </td>
                    <td style={{padding:'12px',textAlign:'center',position:'relative'}}>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation()
                          setOpenMenuId(openMenuId === t.id ? null : t.id)
                        }}
                        style={{padding:'4px 8px',fontSize:'1rem',background:'transparent',border:'none',cursor:'pointer',color:'var(--text)'}}
                      >
                        ⋮
                      </button>
                      {openMenuId === t.id && (
                        <>
                          <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,zIndex:998}} 
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
                              onClick={() => {convertToRecurring(t); setOpenMenuId(null)}}
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
                              <span>🔁</span> Convert to Recurring
                            </button>
                            <button 
                              onClick={() => {startEdit(t.id); setOpenMenuId(null)}}
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
                              onClick={() => {remove(t.id); setOpenMenuId(null)}}
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
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
      <ul className="list">
        {paginatedItems.map((t) => {
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
                  <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,zIndex:998}} 
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
                      onClick={() => {convertToRecurring(t); setOpenMenuId(null)}}
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
                      <span>🔁</span> Convert to Recurring
                    </button>
                    <button 
                      onClick={() => {startEdit(t.id); setOpenMenuId(null)}}
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
                      onClick={() => {remove(t.id); setOpenMenuId(null)}}
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
          </li>
        )
        })}
      </ul>
      )}
        </>
      )}
    </div>
  )
}
