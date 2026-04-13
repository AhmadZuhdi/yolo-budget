import Dexie, { type Table } from 'dexie'
import type { Account, Transaction, Budget, Recurring, Setting } from './types'

export class ExpenseTrackerDB extends Dexie {
  accounts!: Table<Account, number>
  transactions!: Table<Transaction, number>
  budgets!: Table<Budget, number>
  recurring!: Table<Recurring, number>
  settings!: Table<Setting, string>

  constructor() {
    super('YoloExpenseTracker')

    this.version(1).stores({
      // Primary key + indexed fields
      accounts: '++id, name, type, createdAt',
      transactions: '++id, accountId, toAccountId, type, date, isCommitted, *tags, createdAt',
      budgets: '++id, name, period, createdAt',
      recurring: '++id, nextOccurrence, isActive, createdAt',
      settings: 'key',
    })
  }
}

export const db = new ExpenseTrackerDB()

// ─── Seed default data on first load ─────────────────────────────────────────
export async function seedDefaultData() {
  const accountCount = await db.accounts.count()
  if (accountCount > 0) return // already seeded

  const now = new Date().toISOString()

  await db.accounts.bulkAdd([
    {
      name: 'Cash',
      type: 'cash',
      initialBalance: 0,
      currency: 'USD',
      color: '#10b981',
      icon: 'Banknote',
      createdAt: now,
    },
    {
      name: 'Main Bank',
      type: 'bank',
      initialBalance: 0,
      currency: 'USD',
      color: '#6366f1',
      icon: 'Building2',
      createdAt: now,
    },
  ])

  await db.settings.bulkAdd([
    { key: 'currency', value: 'USD' },
    { key: 'theme', value: 'dark' },
  ])
}

// ─── Balance computation helper ───────────────────────────────────────────────
export async function computeAccountBalance(accountId: number): Promise<number> {
  const account = await db.accounts.get(accountId)
  if (!account) return 0

  const committed = await db.transactions
    .where('accountId')
    .equals(accountId)
    .and((tx) => tx.isCommitted)
    .toArray()

  const incomingTransfers = await db.transactions
    .where('toAccountId')
    .equals(accountId)
    .and((tx) => tx.isCommitted && tx.type === 'transfer')
    .toArray()

  let balance = account.initialBalance

  for (const tx of committed) {
    if (tx.type === 'income') {
      balance += tx.amount
    } else if (tx.type === 'expense') {
      balance -= tx.amount
    } else if (tx.type === 'transfer') {
      // outgoing transfer from this account
      balance -= tx.amount
      if (tx.transferFee) balance -= tx.transferFee
    }
  }

  // incoming transfers
  for (const tx of incomingTransfers) {
    balance += tx.amount
  }

  return balance
}

// ─── Bulk commit staged transactions ─────────────────────────────────────────
export async function commitStagedTransactions(
  staged: Omit<Transaction, 'id'>[]
): Promise<void> {
  const committed = staged.map((tx) => ({ ...tx, isCommitted: true }))
  await db.transactions.bulkAdd(committed)
}
