import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { db, Transaction, TransactionLine, Account, Budget, StagedTransaction } from '../db/indexeddb'
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
  const [currency, setCurrency] = useState('USD')
  const [doubleEntry, setDoubleEntry] = useState(true)
  const [loading, setLoading] = useState(true)
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 640)
  
  // Commit-style workflow state
  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [stagedTransactions, setStagedTransactions] = useState<StagedTransaction[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  
  // Form state for new transaction
  const [desc, setDesc] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [budgetId, setBudgetId] = useState('')
  const [tags, setTags] = useState<Tag[]>([])
  const [tagInputValue, setTagInputValue] = useState('')
  const [lineA, setLineA] = useState<{accountId?:string;amount?:number}>({})
  const [lineB, setLineB] = useState<{accountId?:string;amount?:number}>({})
  
  // Push modal state
  const [showPushModal, setShowPushModal] = useState(false)
  const [realAmount, setRealAmount] = useState('')
  const [pushing, setPushing] = useState(false)
  
  // Collapsible sections state
  const [showCreateForm, setShowCreateForm] = useState(true)
  const [showFilters, setShowFilters] = useState(false)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterTag, setFilterTag] = useState('')
  const [filterBudget, setFilterBudget] = useState('')

  function addTagsFromInput() {
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
      db.getMeta<number>('itemsPerPage'),
      db.getMeta<number>('paginationPage')
    ]).then(([transactions, accs, curr, buds, de, savedItemsPerPage, savedPage]) => {
      if (mounted) {
        setItems(transactions)
        setAccounts(accs)
        setCurrency(curr || 'USD')
        setBudgets(buds)
        setDoubleEntry(de !== false)
        if (accs.length > 0) {
          setSelectedAccountId(accs[0].id)
        }
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

  useEffect(() => {
    db.setMeta('itemsPerPage', itemsPerPage)
  }, [itemsPerPage])

  useEffect(() => {
    db.setMeta('paginationPage', currentPage)
  }, [currentPage])

  // Load staged transactions for selected account
  useEffect(() => {
    if (selectedAccountId) {
      db.getStagedTransactions(selectedAccountId).then(staged => {
        setStagedTransactions(staged)
      })
    }
  }, [selectedAccountId])

  // Set default value for realAmount when push modal opens
  useEffect(() => {
    if (showPushModal && selectedAccountId) {
      const expectedAmount = (selectedAccount?.balance || 0) + stagedTransactions.reduce((sum, tx) => {
        const line = tx.lines.find(l => l.accountId === selectedAccountId)
        return sum + (line?.amount || 0)
      }, 0)
      setRealAmount(String(expectedAmount))
    }
  }, [showPushModal])

  const getAccountName = (accountId: string) => {
    return accounts.find(a => a.id === accountId)?.name || accountId
  }

  const selectedAccount = accounts.find(a => a.id === selectedAccountId)

  const getAllTags = () => getAllTagsFromItems(items)

  async function commitTransaction() {
    if (!selectedAccountId) {
      alert('Please select an account')
      return
    }

    const aAmt = Number(lineA.amount || 0)
    
    if (aAmt === 0) {
      alert('Amount cannot be 0')
      return
    }

    // Use selected account if not already set
    if (!lineA.accountId) {
      setLineA(s => ({...s, accountId: selectedAccountId}))
      return
    }

    if (!doubleEntry) {
      // Simple mode: single line
      const tx: StagedTransaction = {
        id: `tx:${Date.now()}`,
        accountId: selectedAccountId,
        date,
        description: desc,
        budgetId: budgetId || undefined,
        tags: tags.length > 0 ? tags.map(t => t.text) : undefined,
        lines: [
          { accountId: lineA.accountId, amount: aAmt }
        ]
      }

      try {
        await db.addStagedTransaction(tx)
        setStagedTransactions(await db.getStagedTransactions(selectedAccountId))
        setDesc('')
        setTags([])
        setLineA({ accountId: lineA.accountId })
        setLineB({})
      } catch (e: any) {
        alert(e.message)
      }
    } else {
      // Double-entry mode
      // Use selected account for lineB if not already set
      if (!lineB.accountId) {
        setLineB(s => ({...s, accountId: selectedAccountId}))
        return
      }

      const bAmt = Number(lineB.amount || 0)
      
      if (bAmt === 0) {
        alert('Amount cannot be 0')
        return
      }
      
      if (Math.abs(aAmt + bAmt) > 1e-6) {
        alert('Transaction must balance (sum of lines = 0)')
        return
      }

      const tx: StagedTransaction = {
        id: `tx:${Date.now()}`,
        accountId: selectedAccountId,
        date,
        description: desc,
        budgetId: budgetId || undefined,
        tags: tags.length > 0 ? tags.map(t => t.text) : undefined,
        lines: [
          { accountId: lineA.accountId, amount: aAmt },
          { accountId: lineB.accountId, amount: bAmt }
        ]
      }

      try {
        await db.addStagedTransaction(tx)
        setStagedTransactions(await db.getStagedTransactions(selectedAccountId))
        setDesc('')
        setTags([])
        setLineA({ accountId: lineA.accountId })
        setLineB({})
      } catch (e: any) {
        alert(e.message)
      }
    }
  }

  async function deleteStagedTransaction(txId: string) {
    try {
      await db.deleteStagedTransaction(txId)
      setStagedTransactions(await db.getStagedTransactions(selectedAccountId))
    } catch (e: any) {
      alert(e.message)
    }
  }

  async function pushChanges() {
    if (!selectedAccountId) return
    
    const realAmt = Number(realAmount || 0)
    if (isNaN(realAmt)) {
      alert('Please enter a valid amount')
      return
    }

    try {
      setPushing(true)
      await db.commitStagedTransactions(selectedAccountId, realAmt)
      
      // Reload transactions and update UI
      const updatedTransactions = await db.getAll<Transaction>('transactions')
      const updatedAccount = await db.get<Account>('accounts', selectedAccountId)
      
      setItems(updatedTransactions)
      if (updatedAccount) {
        setAccounts(accs => accs.map(a => a.id === selectedAccountId ? updatedAccount : a))
      }
      
      setStagedTransactions([])
      setShowPushModal(false)
      setRealAmount('')
      alert('✅ Changes pushed successfully!')
    } catch (e: any) {
      alert('Push error: ' + e.message)
    } finally {
      setPushing(false)
    }
  }

  // Filter and paginate transactions
  const filteredItems = items.filter(t => {
    const matchesSearch = !searchTerm || 
      (t.description && t.description.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesTag = !filterTag || (t.tags && t.tags.includes(filterTag))
    const matchesBudget = !filterBudget || t.budgetId === filterBudget
    return matchesSearch && matchesTag && matchesBudget
  }).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage)
  const paginatedItems = filteredItems.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  function convertToRecurring(transaction: Transaction) {
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

  async function remove(id: string) {
    if (!confirm('Delete transaction?')) return
    await db.deleteTransaction(id)
    setItems(await db.getAll('transactions'))
  }

  if (loading) return <div className="page container">Loading...</div>

  return (
    <div className="page container">
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24}}>
        <h2 style={{fontSize: '1.75rem', fontWeight: 700, margin: 0}}>💸 Transactions</h2>
      </div>

      {/* Account Selector & Balance Display */}
      <div className="card" style={{marginBottom: 24}}>
        <h3 style={{marginTop: 0, marginBottom: 12}}>💳 Select Account</h3>
        <select onChange={(e)=>setSelectedAccountId(e.target.value)} value={selectedAccountId||''} style={{marginBottom: 16}}>
          <option value="">Choose account...</option>
          {accounts.map(a=> <option key={a.id} value={a.id}>{a.name} - {formatCurrency(a.balance || 0, currency)}</option>)}
        </select>

        {selectedAccount && stagedTransactions.length > 0 && (
          <div style={{
            padding: 12,
            background: 'var(--accent-light)',
            borderRadius: '8px',
            border: '1px solid var(--accent)'
          }}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
              <div>
                <span style={{color: 'var(--text-secondary)', fontSize: '0.875rem'}}>Staged Change:</span>
                <div style={{
                  fontSize: '1.25rem', 
                  fontWeight: 600, 
                  color: stagedTransactions.reduce((sum, tx) => {
                    const line = tx.lines.find(l => l.accountId === selectedAccountId)
                    return sum + (line?.amount || 0)
                  }, 0) >= 0 ? 'var(--success, #4caf50)' : 'var(--warning, #ff9800)'
                }}>
                  {formatCurrency(stagedTransactions.reduce((sum, tx) => {
                    const line = tx.lines.find(l => l.accountId === selectedAccountId)
                    return sum + (line?.amount || 0)
                  }, 0), currency)}
                </div>
              </div>
              <div style={{textAlign: 'right'}}>
                <div style={{fontSize: '0.875rem', color: 'var(--text-secondary)'}}>Expected After:</div>
                <div style={{fontSize: '1.25rem', fontWeight: 600, color: 'var(--accent)'}}>
                  {formatCurrency(
                    (selectedAccount?.balance || 0) + stagedTransactions.reduce((sum, tx) => {
                      const line = tx.lines.find(l => l.accountId === selectedAccountId)
                      return sum + (line?.amount || 0)
                    }, 0),
                    currency
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create Transaction Form */}
      <div className="card" style={{marginBottom: 24}}>
        <h3 
          style={{marginTop: 0, marginBottom: showCreateForm ? 12 : 0, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}
          onClick={() => setShowCreateForm(!showCreateForm)}
        >
          <span>💾 Commit Transaction</span>
          <span style={{fontSize: '1.2rem'}}>{showCreateForm ? '▼' : '▶'}</span>
        </h3>

        {showCreateForm && selectedAccountId && (
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
              <input 
                placeholder={doubleEntry ? "Amount" : "Amount (+income / -expense)"} 
                type="number" 
                value={lineA.amount||''} 
                onChange={(e)=>setLineA(s=>({...s,amount: Number(e.target.value)}))} 
              />
            </div>
            
            {doubleEntry && (
              <div style={{display:'flex',gap:8,marginTop:8}}>
                <input placeholder="Amount (negative)" type="number" value={lineB.amount||''} onChange={(e)=>setLineB(s=>({...s,amount: Number(e.target.value)}))} />
              </div>
            )}
            
            <button onClick={commitTransaction} style={{marginTop:8}} className="button-primary">💾 Commit</button>
          </>
        )}
      </div>

      {/* Staged Transactions List */}
      {stagedTransactions.length > 0 && (
        <div className="card" style={{
          marginBottom: 24,
          background: 'linear-gradient(135deg, var(--accent-light), var(--bg-secondary))',
          border: `2px solid var(--accent)`
        }}>
          <h3 style={{marginTop: 0}}>📋 Staged Transactions ({stagedTransactions.length})</h3>
          <div style={{display: 'grid', gap: 8}}>
            {stagedTransactions.map((tx) => {
              const accountLine = tx.lines.find(l => l.accountId === selectedAccountId)
              return (
                <div 
                  key={tx.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: 12,
                    background: 'var(--bg-secondary)',
                    borderRadius: '4px',
                    border: '1px solid var(--border)'
                  }}
                >
                  <div>
                    <div style={{fontWeight: 600}}>{tx.description || '(no description)'}</div>
                    <div style={{fontSize: '0.875rem', color: 'var(--text-secondary)'}}>
                      {tx.date} · {tx.budgetId ? budgets.find(b => b.id === tx.budgetId)?.name : 'No budget'}
                    </div>
                  </div>
                  <div style={{display: 'flex', alignItems: 'center', gap: 16}}>
                    <div style={{
                      fontSize: '1.125rem',
                      fontWeight: 600,
                      color: (accountLine?.amount || 0) >= 0 ? 'var(--success, #4caf50)' : 'var(--warning, #ff9800)'
                    }}>
                      {(accountLine?.amount || 0) >= 0 ? '+' : ''}{formatCurrency(accountLine?.amount || 0, currency)}
                    </div>
                    <button 
                      onClick={() => deleteStagedTransaction(tx.id)}
                      style={{
                        padding: '4px 8px',
                        background: 'var(--danger, #f44336)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.875rem'
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          <button 
            onClick={() => setShowPushModal(true)}
            style={{
              marginTop: 16,
              width: '100%',
              padding: '12px',
              background: 'var(--accent)',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: 600
            }}
          >
            🚀 Push Changes
          </button>
        </div>
      )}

      {/* Push Modal */}
      {showPushModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: '#f0f0f0',
            padding: 24,
            borderRadius: '8px',
            maxWidth: 400,
            width: '90%',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            border: '1px solid #ccc',
            color: '#333'
          }}>
            <h3>🚀 Push Changes</h3>
            <p>Enter the current real amount in <strong>{selectedAccount?.name}</strong>:</p>
            
            <div style={{marginBottom: 16}}>
              <div style={{fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 8}}>
                Recorded Balance: <strong>{formatCurrency(selectedAccount?.balance || 0, currency)}</strong>
              </div>
              <div style={{fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 8}}>
                Expected After Changes: <strong>
                  {formatCurrency(
                    (selectedAccount?.balance || 0) + stagedTransactions.reduce((sum, tx) => {
                      const line = tx.lines.find(l => l.accountId === selectedAccountId)
                      return sum + (line?.amount || 0)
                    }, 0),
                    currency
                  )}
                </strong>
              </div>
            </div>

            <input 
              type="number" 
              value={realAmount} 
              onChange={(e) => setRealAmount(e.target.value)}
              placeholder="Enter real current amount"
              step="0.01"
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid var(--border)',
                marginBottom: 16,
                boxSizing: 'border-box'
              }}
            />

            <div style={{display: 'flex', gap: 8}}>
              <button 
                onClick={() => {
                  setShowPushModal(false)
                  setRealAmount('')
                }}
                style={{
                  flex: 1,
                  padding: '8px',
                  background: 'var(--border)',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button 
                onClick={pushChanges}
                disabled={pushing}
                style={{
                  flex: 1,
                  padding: '8px',
                  background: 'var(--accent)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: pushing ? 'not-allowed' : 'pointer',
                  opacity: pushing ? 0.6 : 1
                }}
              >
                {pushing ? 'Pushing...' : '✓ Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card" style={{marginBottom: 24}}>
        <h3 
          style={{margin: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8}}
          onClick={() => setShowFilters(!showFilters)}
        >
          <span>🔍 Filter & Search</span>
          <span style={{fontSize: '1.2rem'}}>{showFilters ? '▼' : '▶'}</span>
        </h3>

        {showFilters && (
          <div style={{marginTop: 16, display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 12}}>
            <input 
              type="text" 
              value={searchTerm} 
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setCurrentPage(1)
              }}
              placeholder="Search description"
            />

            <select 
              value={filterBudget} 
              onChange={(e) => {
                setFilterBudget(e.target.value)
                setCurrentPage(1)
              }}
            >
              <option value="">All Budgets</option>
              {budgets.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>

            <select 
              value={filterTag} 
              onChange={(e) => {
                setFilterTag(e.target.value)
                setCurrentPage(1)
              }}
            >
              <option value="">All Tags</option>
              {getAllTags().map((tag, idx) => (
                <option key={idx} value={tag}>{tag}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="card" style={{marginBottom: 24, padding: '12px'}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
            <label style={{fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: 500}}>Items per page:</label>
            <select 
              value={itemsPerPage} 
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value))
                setCurrentPage(1)
              }}
              style={{padding: '6px 8px', borderRadius: 4, border: '1px solid var(--border)'}}
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          <div style={{display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap'}}>
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              style={{
                padding: '6px 12px',
                border: '1px solid var(--border)',
                borderRadius: 4,
                background: 'var(--bg)',
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                opacity: currentPage === 1 ? 0.5 : 1
              }}
            >
              ← Previous
            </button>
            
            {!isMobile && totalPages > 5 ? (
              Array.from({length: totalPages}, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  style={{
                    padding: '6px 10px',
                    border: currentPage === page ? '2px solid var(--accent)' : '1px solid var(--border)',
                    borderRadius: 4,
                    background: currentPage === page ? 'var(--accent)' : 'var(--bg)',
                    color: currentPage === page ? 'white' : 'inherit',
                    cursor: 'pointer'
                  }}
                >
                  {page}
                </button>
              ))
            ) : (
              <span style={{fontSize: '0.875rem', color: 'var(--text-secondary)'}}>
                Page {currentPage} of {totalPages}
              </span>
            )}

            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              style={{
                padding: '6px 12px',
                border: '1px solid var(--border)',
                borderRadius: 4,
                background: 'var(--bg)',
                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                opacity: currentPage === totalPages ? 0.5 : 1
              }}
            >
              Next →
            </button>
          </div>

          <div style={{fontSize: '0.875rem', color: 'var(--text-secondary)'}}>
            {filteredItems.length === 0 ? 'No transactions' : `${(currentPage - 1) * itemsPerPage + 1}–${Math.min(currentPage * itemsPerPage, filteredItems.length)} of ${filteredItems.length}`}
          </div>
        </div>
      </div>

      {/* Transactions Display */}
      <div className="card">
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16}}>
          <h3 style={{margin: 0}}>📊 Transaction History</h3>
          <div style={{display: 'flex', gap: 8}}>
            <button 
              onClick={() => setViewMode('card')}
              style={{
                padding: '8px 12px',
                background: viewMode === 'card' ? 'var(--accent)' : 'var(--border)',
                color: viewMode === 'card' ? 'white' : 'inherit',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.875rem'
              }}
            >
              🃏 Cards
            </button>
            <button 
              onClick={() => setViewMode('table')}
              style={{
                padding: '8px 12px',
                background: viewMode === 'table' ? 'var(--accent)' : 'var(--border)',
                color: viewMode === 'table' ? 'white' : 'inherit',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.875rem'
              }}
            >
              📊 Table
            </button>
          </div>
        </div>

        {paginatedItems.length === 0 ? (
          <div style={{padding: 24, textAlign: 'center', color: 'var(--text-secondary)'}}>
            No transactions found
          </div>
        ) : viewMode === 'card' ? (
          <div style={{display: 'grid', gap: isMobile ? 8 : 12, gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))'}}>
            {paginatedItems.map(tx => (
              <div 
                key={tx.id}
                style={{
                  padding: isMobile ? 10 : 16,
                  background: 'var(--bg-secondary)',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  position: 'relative',
                  minWidth: 0
                }}
              >
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: isMobile ? 6 : 8}}>
                  <div style={{flex: 1, minWidth: 0}}>
                    <div style={{fontWeight: 600, fontSize: isMobile ? '0.875rem' : '1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{tx.description || '(no description)'}</div>
                    <div style={{fontSize: isMobile ? '0.75rem' : '0.875rem', color: 'var(--text-secondary)'}}>
                      {tx.date}
                    </div>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation()
                      setOpenMenuId(openMenuId === tx.id ? null : tx.id)
                    }}
                    style={{padding: '2px 6px', fontSize: isMobile ? '0.875rem' : '1rem', background: 'transparent', border: 'none', cursor: 'pointer', flexShrink: 0}}
                  >
                    ⋮
                  </button>
                </div>
                {tx.budgetId && (
                  <div style={{fontSize: isMobile ? '0.7rem' : '0.875rem', marginBottom: 6, color: 'var(--accent)'}}>
                    📊 {budgets.find(b => b.id === tx.budgetId)?.name}
                  </div>
                )}
                {tx.tags && tx.tags.length > 0 && (
                  <div style={{display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 6}}>
                    {tx.tags.map((tag, idx) => (
                      <span key={idx} style={{
                        fontSize: isMobile ? '0.65rem' : '0.75rem',
                        background: 'var(--accent)',
                        color: 'white',
                        padding: isMobile ? '1px 6px' : '2px 8px',
                        borderRadius: '12px'
                      }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <div style={{borderTop: '1px solid var(--border)', paddingTop: 6}}>
                  {tx.lines.map((line, idx) => (
                    <div key={idx} style={{display: 'flex', justifyContent: 'space-between', fontSize: isMobile ? '0.75rem' : '0.875rem', marginBottom: idx < tx.lines.length - 1 ? 3 : 0}}>
                      <span style={{overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1}}>{getAccountName(line.accountId)}</span>
                      <span style={{color: line.amount >= 0 ? 'var(--success, #4caf50)' : 'var(--warning, #ff9800)', marginLeft: 8, whiteSpace: 'nowrap'}}>
                        {line.amount >= 0 ? '+' : ''}{formatCurrency(line.amount, currency)}
                      </span>
                    </div>
                  ))}
                </div>

                {openMenuId === tx.id && (
                  <>
                    <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 998}} 
                      onClick={() => setOpenMenuId(null)}
                    />
                    <div style={{
                      position: 'absolute',
                      right: 0,
                      top: '100%',
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                      minWidth: 160,
                      zIndex: 999,
                      overflow: 'hidden'
                    }}>
                      <button onClick={() => { convertToRecurring(tx); setOpenMenuId(null) }} style={{display: 'block', width: '100%', padding: 12, border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', fontSize: '0.875rem'}}>📅 Convert to Recurring</button>
                      <button onClick={() => { remove(tx.id); setOpenMenuId(null) }} style={{display: 'block', width: '100%', padding: 12, border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', fontSize: '0.875rem', color: 'var(--warning, #ff9800)'}}>🗑️ Delete</button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div style={{overflowX: 'auto'}}>
            <table style={{width: '100%', borderCollapse: 'collapse'}}>
              <thead>
                <tr style={{background: 'var(--accent-light)', borderBottom: '2px solid var(--border)'}}>
                  <th style={{padding: 12, textAlign: 'left', fontSize: '0.875rem'}}>Date</th>
                  <th style={{padding: 12, textAlign: 'left', fontSize: '0.875rem'}}>Description</th>
                  <th style={{padding: 12, textAlign: 'left', fontSize: '0.875rem'}}>Accounts</th>
                  <th style={{padding: 12, textAlign: 'right', fontSize: '0.875rem'}}>Amount</th>
                  <th style={{padding: 12, textAlign: 'left', fontSize: '0.875rem'}}>Budget</th>
                  <th style={{padding: 12, textAlign: 'center', fontSize: '0.875rem', width: '60px'}}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedItems.map(tx => (
                  <tr key={tx.id} style={{borderBottom: '1px solid var(--border)'}}>
                    <td style={{padding: 12, fontSize: '0.875rem', whiteSpace: 'nowrap'}}>{tx.date}</td>
                    <td style={{padding: 12, fontSize: '0.875rem'}}>{tx.description || '—'}</td>
                    <td style={{padding: 12, fontSize: '0.875rem'}}>
                      {tx.lines.map(l => getAccountName(l.accountId)).join(' ↔ ')}
                    </td>
                    <td style={{padding: 12, textAlign: 'right', fontSize: '0.875rem', fontWeight: 600}}>
                      {tx.lines.filter(l => l.amount > 0).map(l => formatCurrency(l.amount, currency)).join(', ')}
                    </td>
                    <td style={{padding: 12, fontSize: '0.875rem'}}>
                      {tx.budgetId ? budgets.find(b => b.id === tx.budgetId)?.name : '—'}
                    </td>
                    <td style={{padding: 12, textAlign: 'center', position: 'relative'}}>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation()
                          setOpenMenuId(openMenuId === tx.id ? null : tx.id)
                        }}
                        style={{padding: '4px 8px', fontSize: '1rem', background: 'transparent', border: 'none', cursor: 'pointer'}}
                      >
                        ⋮
                      </button>
                      {openMenuId === tx.id && (
                        <>
                          <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 998}} 
                            onClick={() => setOpenMenuId(null)}
                          />
                          <div style={{
                            position: 'absolute',
                            right: 0,
                            top: '100%',
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border)',
                            borderRadius: 6,
                            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                            minWidth: 160,
                            zIndex: 999,
                            overflow: 'hidden'
                          }}>
                            <button 
                              onClick={() => {convertToRecurring(tx); setOpenMenuId(null)}}
                              style={{width: '100%', padding: '10px 16px', textAlign: 'left', background: 'var(--bg-secondary)', border: 'none', cursor: 'pointer', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: 8}}
                              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--accent-light)'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
                            >
                              <span>🔁</span> Convert to Recurring
                            </button>
                            <button 
                              onClick={() => {remove(tx.id); setOpenMenuId(null)}}
                              style={{width: '100%', padding: '10px 16px', textAlign: 'left', background: 'var(--bg-secondary)', border: '1px solid var(--border)', cursor: 'pointer', fontSize: '0.875rem', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 8}}
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
