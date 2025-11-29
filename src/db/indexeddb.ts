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
  lines: TransactionLine[]
}

export type RecurringTransaction = {
  id: string
  description: string
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly'
  startDate: string
  endDate?: string
  lastProcessed?: string
  lines: TransactionLine[]
  active: boolean
}

let dbPromise: Promise<IDBPDatabase<unknown>>

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB('yolo-budget-db', 4, {
      upgrade(db, oldVersion) {
        if (!db.objectStoreNames.contains('accounts')) db.createObjectStore('accounts', { keyPath: 'id' })
        if (!db.objectStoreNames.contains('budgets')) db.createObjectStore('budgets', { keyPath: 'id' })
        if (!db.objectStoreNames.contains('transactions')) db.createObjectStore('transactions', { keyPath: 'id' })
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
  async processRecurringTransactions() {
    const recurring = await this.getAll<RecurringTransaction>('recurringTransactions')
    const today = new Date().toISOString().slice(0, 10)
    
    for (const r of recurring) {
      if (!r.active) continue
      if (r.endDate && r.endDate < today) continue
      
      const lastProcessed = r.lastProcessed || r.startDate
      if (this.shouldProcess(lastProcessed, today, r.frequency)) {
        // Create transaction from recurring template
        const tx: Transaction = {
          id: `tx:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
          date: today,
          description: r.description + ' (recurring)',
          lines: r.lines
        }
        
        await this.addTransaction(tx)
        
        // Update last processed date
        r.lastProcessed = today
        await this.put('recurringTransactions', r)
      }
    }
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
  }
}
