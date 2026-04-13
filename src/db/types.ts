// ─── Account ─────────────────────────────────────────────────────────────────

export type AccountType =
  | 'cash'
  | 'bank'
  | 'credit_card'
  | 'savings'
  | 'investment'
  | 'other'

export interface Account {
  id?: number
  name: string
  type: AccountType
  initialBalance: number
  currency: string
  color: string   // hex color for UI differentiation
  icon: string    // lucide icon name
  createdAt: string // ISO date string
}

// ─── Transaction ─────────────────────────────────────────────────────────────

export type TransactionType = 'income' | 'expense' | 'transfer'

export interface Transaction {
  id?: number
  accountId: number
  type: TransactionType
  amount: number
  date: string        // ISO date string (YYYY-MM-DD)
  description: string
  tags: string[]
  isCommitted: boolean
  // Transfer-specific
  toAccountId?: number
  transferFee?: number
  createdAt: string   // ISO date string
}

// ─── Budget ──────────────────────────────────────────────────────────────────

export type BudgetPeriod = 'weekly' | 'monthly' | 'yearly'

export interface Budget {
  id?: number
  name: string
  targetTags: string[]   // tags to track spending against
  limitAmount: number
  period: BudgetPeriod
  createdAt: string
}

// ─── Recurring Transaction ────────────────────────────────────────────────────

export type RecurringFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly'

export interface RecurringTemplate {
  accountId: number
  type: TransactionType
  amount: number
  description: string
  tags: string[]
  toAccountId?: number
  transferFee?: number
}

export interface Recurring {
  id?: number
  templateTransaction: RecurringTemplate
  frequency: RecurringFrequency
  nextOccurrence: string  // ISO date string
  isActive: boolean
  createdAt: string
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export type SettingKey =
  | 'githubPat'
  | 'gistId'
  | 'currency'
  | 'theme'
  | 'lastSyncAt'

export interface Setting {
  key: SettingKey
  value: string
}

// ─── Staging (in-memory only, not persisted to DB) ────────────────────────────

export interface StagedTransaction {
  id: string  // temporary UUID for list key
  accountId: number
  type: TransactionType
  amount: number
  date: string
  description: string
  tags: string[]
  toAccountId?: number
  transferFee?: number
}

// ─── Derived / Computed ──────────────────────────────────────────────────────

export interface AccountWithBalance extends Account {
  balance: number  // computed: initialBalance + committed income - committed expense
}

export interface BudgetWithSpending extends Budget {
  spent: number    // computed: sum of expenses with matching tags in current period
  percentage: number
  status: 'safe' | 'warning' | 'danger'
}

// ─── Gist Sync Payload ────────────────────────────────────────────────────────

export interface GistSyncPayload {
  version: number
  exportedAt: string
  accounts: Account[]
  transactions: Transaction[]
  budgets: Budget[]
  recurring: Recurring[]
}
