import { openDB, IDBPDatabase } from 'idb'

export type Account = {
  id: string
  name: string
  type: 'bank' | 'cash' | 'credit' | 'other'
  balance?: number
}

export type Budget = {
  id: string
  name: string
  amount: number
}

export type TransactionLine = {
  accountId: string
  amount: number // positive for debit, negative for credit depending on convention
}

export type Transaction = {
  id: string
  date: string
  description?: string
  budgetId?: string
  tags?: string[]
  lines: TransactionLine[]
}

export type RecurringTransaction = {
  id: string
  description: string
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly'
  startDate: string
  endDate?: string
  lastProcessed?: string
  budgetId?: string
  tags?: string[]
  lines: TransactionLine[]
  active: boolean
}

export type StagedTransaction = {
  id: string
  accountId: string
  date: string
  description?: string
  budgetId?: string
  tags?: string[]
  lines: TransactionLine[]
}

let dbPromise: Promise<IDBPDatabase<unknown>>

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB('yolo-budget-db', 5, {
      upgrade(db, oldVersion) {
        if (!db.objectStoreNames.contains('accounts')) db.createObjectStore('accounts', { keyPath: 'id' })
        if (!db.objectStoreNames.contains('budgets')) db.createObjectStore('budgets', { keyPath: 'id' })
        if (!db.objectStoreNames.contains('transactions')) db.createObjectStore('transactions', { keyPath: 'id' })
        if (!db.objectStoreNames.contains('stagedTransactions')) db.createObjectStore('stagedTransactions', { keyPath: 'id' })
        if (!db.objectStoreNames.contains('syncQueue')) db.createObjectStore('syncQueue', { keyPath: 'id' })
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' })
        if (!db.objectStoreNames.contains('recurringTransactions')) db.createObjectStore('recurringTransactions', { keyPath: 'id' })
      }
    })
  }
  return dbPromise
}

export const db = {
  async add(store: string, item: any) {
    const db = await getDB()
    return (db as any).add(store, item)
  },
  async put(store: string, item: any) {
    const db = await getDB()
    return (db as any).put(store, item)
  },
  async getAll<T = any>(store: string): Promise<T[]> {
    const db = await getDB()
    return (db as any).getAll(store)
  },
  async get<T = any>(store: string, key: any): Promise<T | undefined> {
    const db = await getDB()
    return (db as any).get(store, key)
  },
  async delete(store: string, key: any) {
    const db = await getDB()
    return (db as any).delete(store, key)
  },

  // Meta helpers
  async getMeta<T = any>(key: string): Promise<T | undefined> {
    const db = await getDB()
    const rec = await (db as any).get('meta', key)
    return rec?.value
  },
  async setMeta(key: string, value: any) {
    const db = await getDB()
    return (db as any).put('meta', { key, value })
  },

  // Export / Import whole DB as JSON
  async exportAll() {
    const accounts = await this.getAll('accounts')
    const budgets = await this.getAll('budgets')
    const transactions = await this.getAll('transactions')
    const recurringTransactions = await this.getAll('recurringTransactions')
    const meta = await this.getAll('meta')
    return { accounts, budgets, transactions, recurringTransactions, meta }
  },

  async importAll(data: { accounts?: any[]; budgets?: any[]; transactions?: any[]; recurringTransactions?: any[]; meta?: any[] }, options?: { clearBefore?: boolean }) {
    if (options?.clearBefore) {
      const db = await getDB()
      // naive clear of known stores
      await (db as any).clear('accounts')
      await (db as any).clear('budgets')
      await (db as any).clear('transactions')
      await (db as any).clear('recurringTransactions')
      await (db as any).clear('syncQueue')
      await (db as any).clear('meta')
    }
    for (const a of data.accounts || []) await this.put('accounts', a)
    for (const b of data.budgets || []) await this.put('budgets', b)
    for (const t of data.transactions || []) await this.put('transactions', t)
    for (const r of data.recurringTransactions || []) await this.put('recurringTransactions', r)
    for (const m of data.meta || []) await this.put('meta', m)
  },

  // Helpers for bookkeeping
  async addTransaction(tx: Transaction) {
    // Ensure double-entry: sum of amounts should be 0
    const sum = tx.lines.reduce((s, l) => s + l.amount, 0)
    if (Math.abs(sum) > 1e-6) throw new Error('Transaction not balanced')
    await this.put('transactions', tx)
    // update account balances (best-effort, concurrency caveats)
    for (const line of tx.lines) {
      const acc = await this.get<Account>('accounts', line.accountId)
      if (acc) {
        acc.balance = (acc.balance || 0) + line.amount
        await this.put('accounts', acc)
      }
    }
    // enqueue for sync
    await this.enqueueSync({ collection: 'transactions', payload: tx })
  },

  async updateTransaction(tx: Transaction) {
    // load existing
    const old = await this.get<Transaction>('transactions', tx.id)
    if (!old) throw new Error('Transaction not found')
    // rollback old lines from account balances
    for (const line of old.lines) {
      const acc = await this.get<Account>('accounts', line.accountId)
      if (acc) {
        acc.balance = (acc.balance || 0) - line.amount
        await this.put('accounts', acc)
      }
    }
    // apply new lines
    const sum = tx.lines.reduce((s, l) => s + l.amount, 0)
    if (Math.abs(sum) > 1e-6) throw new Error('Transaction not balanced')
    await this.put('transactions', tx)
    for (const line of tx.lines) {
      const acc = await this.get<Account>('accounts', line.accountId)
      if (acc) {
        acc.balance = (acc.balance || 0) + line.amount
        await this.put('accounts', acc)
      }
    }
    await this.enqueueSync({ collection: 'transactions', payload: tx })
  },

  async deleteTransaction(id: string) {
    const old = await this.get<Transaction>('transactions', id)
    if (!old) return
    // rollback balances
    for (const line of old.lines) {
      const acc = await this.get<Account>('accounts', line.accountId)
      if (acc) {
        acc.balance = (acc.balance || 0) - line.amount
        await this.put('accounts', acc)
      }
    }
    await this.delete('transactions', id)
    await this.enqueueSync({ collection: 'transactions', payload: { id, _deleted: true } })
  },

  async enqueueSync(item: { id?: string; collection: string; payload: any }) {
    const id = item.id || `${item.collection}:${Date.now()}:${Math.random().toString(36).slice(2,8)}`
    await this.put('syncQueue', { id, ...item })
  },

  // Recurring transactions processing

  async processRecurringTransaction(id: string) {
    // Process a single recurring transaction (force process)
    const r = await this.get<RecurringTransaction>('recurringTransactions', id)
    if (!r) throw new Error('Recurring transaction not found')
    
    const today = new Date().toISOString().slice(0, 10)
    const doubleEntry = await this.getMeta<boolean>('doubleEntry')
    const isDoubleEntry = doubleEntry !== false
    
    console.log(`[ProcessSingle] Processing "${r.description}" on ${today}`)
    
    try {
      // Create transaction from recurring template
      const tx: Transaction = {
        id: `tx:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
        date: today,
        description: r.description + ' (recurring)',
        budgetId: r.budgetId,
        tags: r.tags,
        lines: r.lines
      }
      
      console.log(`[ProcessSingle] Creating transaction:`, tx)
      
      if (isDoubleEntry) {
        // Validate balanced transaction for double-entry mode
        const sum = tx.lines.reduce((s, l) => s + l.amount, 0)
        console.log(`[ProcessSingle] Double-entry mode, balance sum: ${sum}`)
        if (Math.abs(sum) > 1e-6) {
          throw new Error(`Not balanced! sum: ${sum}`)
        }
        await this.addTransaction(tx)
      } else {
        // Simple mode: add transaction and update account balance
        console.log(`[ProcessSingle] Simple mode, saving transaction`)
        await this.add('transactions', tx)
        if (tx.lines[0]) {
          const acc = await this.get<Account>('accounts', tx.lines[0].accountId)
          if (acc) {
            console.log(`[ProcessSingle] Updating balance for account ${tx.lines[0].accountId}: ${acc.balance} + ${tx.lines[0].amount}`)
            acc.balance = (acc.balance || 0) + tx.lines[0].amount
            await this.put('accounts', acc)
          }
        }
      }
      
      // Update last processed date
      r.lastProcessed = today
      await this.put('recurringTransactions', r)
      console.log(`[ProcessSingle] ✅ Processed successfully`)
    } catch (err) {
      console.error(`[ProcessSingle] ❌ Error:`, err)
      throw err
    }
  },

  async processRecurringTransactions() {
    const recurring = await this.getAll<RecurringTransaction>('recurringTransactions')
    const today = new Date().toISOString().slice(0, 10)
    const doubleEntry = await this.getMeta<boolean>('doubleEntry')
    const isDoubleEntry = doubleEntry !== false
    
    console.log(`[Process] Found ${recurring.length} recurring transactions, mode: ${isDoubleEntry ? 'double-entry' : 'simple'}, today: ${today}`)
    
    let processed = 0
    for (const r of recurring) {
      console.log(`[Process] Checking "${r.description}" - active: ${r.active}, endDate: ${r.endDate}, lines: ${r.lines.length}`)
      if (!r.active) {
        console.log(`[Process]   → Skipped (inactive)`)
        continue
      }
      if (r.endDate && r.endDate < today) {
        console.log(`[Process]   → Skipped (ended on ${r.endDate})`)
        continue
      }
      
      const lastProcessed = r.lastProcessed || r.startDate
      const shouldProc = this.shouldProcess(lastProcessed, today, r.frequency)
      console.log(`[Process]   → Should process: ${shouldProc} (last: ${lastProcessed}, freq: ${r.frequency})`)
      
      if (shouldProc) {
        try {
          // Create transaction from recurring template
          const tx: Transaction = {
            id: `tx:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
            date: today,
            description: r.description + ' (recurring)',
            budgetId: r.budgetId,
            tags: r.tags,
            lines: r.lines
          }
          
          console.log(`[Process]   → Creating transaction:`, tx)
          
          if (isDoubleEntry) {
            // Validate balanced transaction for double-entry mode
            const sum = tx.lines.reduce((s, l) => s + l.amount, 0)
            console.log(`[Process]   → Double-entry mode, balance sum: ${sum}`)
            if (Math.abs(sum) > 1e-6) {
              console.error(`[Process]   → ❌ Not balanced! sum: ${sum}`)
              continue
            }
            await this.addTransaction(tx)
          } else {
            // Simple mode: add transaction and update account balance
            console.log(`[Process]   → Simple mode, saving transaction`)
            await this.add('transactions', tx)
            if (tx.lines[0]) {
              const acc = await this.get<Account>('accounts', tx.lines[0].accountId)
              if (acc) {
                console.log(`[Process]   → Updating balance for account ${tx.lines[0].accountId}: ${acc.balance} + ${tx.lines[0].amount}`)
                acc.balance = (acc.balance || 0) + tx.lines[0].amount
                await this.put('accounts', acc)
              }
            }
          }
          
          // Update last processed date
          r.lastProcessed = today
          await this.put('recurringTransactions', r)
          console.log(`[Process]   → ✅ Processed successfully`)
          processed++
        } catch (err) {
          console.error(`[Process]   → ❌ Error:`, err)
        }
      }
    }
    console.log(`[Process] Done. Processed ${processed}/${recurring.length}`)
  },

  shouldProcess(lastProcessed: string, today: string, frequency: RecurringTransaction['frequency']): boolean {
    const last = new Date(lastProcessed)
    const now = new Date(today)
    const diffDays = Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24))
    
    switch (frequency) {
      case 'daily': return diffDays >= 1
      case 'weekly': return diffDays >= 7
      case 'monthly': {
        const monthsDiff = (now.getFullYear() - last.getFullYear()) * 12 + (now.getMonth() - last.getMonth())
        return monthsDiff >= 1
      }
      case 'yearly': {
        return now.getFullYear() > last.getFullYear()
      }
      default: return false
    }
  },

  // Staged transactions (commit-style workflow)
  async getStagedTransactions(accountId: string): Promise<StagedTransaction[]> {
    const allStaged = await this.getAll<StagedTransaction>('stagedTransactions')
    return allStaged.filter(st => st.accountId === accountId)
  },

  async addStagedTransaction(tx: StagedTransaction) {
    return this.add('stagedTransactions', tx)
  },

  async deleteStagedTransaction(txId: string) {
    return this.delete('stagedTransactions', txId)
  },

  async clearStagedTransactions(accountId: string) {
    const allStaged = await this.getAll<StagedTransaction>('stagedTransactions')
    const dbInst = await getDB()
    const tx = dbInst.transaction('stagedTransactions', 'readwrite')
    for (const st of allStaged) {
      if (st.accountId === accountId) {
        await tx.store.delete(st.id)
      }
    }
  },

  async commitStagedTransactions(accountId: string, realCurrentAmount: number): Promise<Transaction[]> {
    const staged = await this.getStagedTransactions(accountId)
    if (staged.length === 0) {
      throw new Error('No staged transactions to commit')
    }

    // Get current account balance
    const account = await this.get<Account>('accounts', accountId)
    if (!account) throw new Error('Account not found')

    // Calculate expected balance after staged transactions
    let expectedBalance = account.balance || 0
    const allTransactions: Transaction[] = []

    // Create transactions from staged
    for (const st of staged) {
      const tx: Transaction = {
        id: st.id,
        date: st.date,
        description: st.description,
        budgetId: st.budgetId,
        tags: st.tags,
        lines: st.lines
      }
      allTransactions.push(tx)
      
      // Sum up the account's line changes
      const accountLine = st.lines.find(l => l.accountId === accountId)
      if (accountLine) {
        expectedBalance += accountLine.amount
      }
    }

    // Create reconciliation transaction if needed
    if (Math.abs((realCurrentAmount - expectedBalance)) > 1e-6) {
      const difference = realCurrentAmount - expectedBalance
      const reconcileTx: Transaction = {
        id: `reconcile:${Date.now()}`,
        date: new Date().toISOString().slice(0, 10),
        description: `Reconciliation adjustment (expected ${expectedBalance.toFixed(2)}, actual ${realCurrentAmount.toFixed(2)})`,
        lines: [
          { accountId, amount: difference }
        ]
      }
      allTransactions.push(reconcileTx)
    }

    // Save all transactions
    for (const tx of allTransactions) {
      await this.put('transactions', tx)
    }

    // Update account balance
    account.balance = realCurrentAmount
    await this.put('accounts', account)

    // Clear staged transactions
    await this.clearStagedTransactions(accountId)

    return allTransactions
  }
}
