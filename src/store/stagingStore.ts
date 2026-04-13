import { create } from 'zustand'
import { db } from '@/db/db'
import type { StagedTransaction, TransactionType } from '@/db/types'

function uuid(): string {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)
}

interface StagingStore {
  staged: StagedTransaction[]
  isOpen: boolean

  // Sheet open/close
  openSheet: () => void
  closeSheet: () => void
  toggleSheet: () => void

  // Staging operations
  addToStaging: (tx: Omit<StagedTransaction, 'id'>) => void
  removeFromStaging: (id: string) => void
  updateStaged: (id: string, data: Partial<Omit<StagedTransaction, 'id'>>) => void
  clearStaging: () => void

  // Commit all staged transactions to DB
  commitAll: () => Promise<number>
}

export const useStagingStore = create<StagingStore>((set, get) => ({
  staged: [],
  isOpen: false,

  openSheet: () => set({ isOpen: true }),
  closeSheet: () => set({ isOpen: false }),
  toggleSheet: () => set((s) => ({ isOpen: !s.isOpen })),

  addToStaging: (tx) =>
    set((s) => ({
      staged: [...s.staged, { ...tx, id: uuid() }],
      isOpen: true, // auto-open sheet when something is staged
    })),

  removeFromStaging: (id) =>
    set((s) => ({ staged: s.staged.filter((tx) => tx.id !== id) })),

  updateStaged: (id, data) =>
    set((s) => ({
      staged: s.staged.map((tx) => (tx.id === id ? { ...tx, ...data } : tx)),
    })),

  clearStaging: () => set({ staged: [] }),

  commitAll: async () => {
    const { staged } = get()
    if (staged.length === 0) return 0

    const now = new Date().toISOString()
    const records = staged.map(({ id: _id, ...tx }) => ({
      ...tx,
      isCommitted: true,
      createdAt: now,
    }))

    await db.transactions.bulkAdd(records)
    set({ staged: [], isOpen: false })
    return records.length
  },
}))

// ─── Terminal input parser ────────────────────────────────────────────────────
// Syntax:
//   -50 Coffee #food @Cash          → expense $50
//   +2000 Salary #income @Bank      → income $2000
//   >500 @Bank to @Cash #transfer   → transfer $500 from Bank to Cash
//   >500 @Bank to @Cash fee:2.5     → transfer with $2.50 fee

export interface ParsedTerminalInput {
  type: TransactionType
  amount: number
  description: string
  tags: string[]
  accountName?: string
  toAccountName?: string
  transferFee?: number
  error?: string
}

export function parseTerminalInput(input: string): ParsedTerminalInput | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  const result: ParsedTerminalInput = {
    type: 'expense',
    amount: 0,
    description: '',
    tags: [],
  }

  // Extract tags (#word)
  const tagMatches = trimmed.match(/#[\w-]+/g) ?? []
  result.tags = tagMatches.map((t) => t.slice(1).toLowerCase())

  // Extract accounts (@word or @multi word — up to next @ or # or end)
  const accountMatches = trimmed.match(/@([\w\s]+?)(?=\s+[@#]|\s+to\s+|fee:|$)/gi) ?? []
  const accounts = accountMatches.map((a) =>
    a.replace(/^@/, '').replace(/\s+to\s+.*/i, '').trim()
  )

  // Extract fee
  const feeMatch = trimmed.match(/fee:([\d.]+)/i)
  if (feeMatch) result.transferFee = parseFloat(feeMatch[1])

  // Determine type from prefix
  const prefix = trimmed[0]

  if (prefix === '>') {
    // Transfer: >500 @Bank to @Cash
    result.type = 'transfer'
    const amountMatch = trimmed.match(/^>([\d.]+)/)
    if (!amountMatch) { result.error = 'Missing amount after >'; return result }
    result.amount = parseFloat(amountMatch[1])
    result.accountName = accounts[0]
    result.toAccountName = accounts[1]
    // Description = everything between amount and first @/#/fee
    const desc = trimmed
      .replace(/^>[\d.]+\s*/, '')
      .replace(/#[\w-]+/g, '')
      .replace(/@[\w\s]+/g, '')
      .replace(/fee:[\d.]+/gi, '')
      .replace(/\bto\b/gi, '')
      .trim()
    result.description = desc || 'Transfer'
  } else if (prefix === '+') {
    result.type = 'income'
    const amountMatch = trimmed.match(/^\+([\d.]+)/)
    if (!amountMatch) { result.error = 'Missing amount after +'; return result }
    result.amount = parseFloat(amountMatch[1])
    result.accountName = accounts[0]
    const desc = trimmed
      .replace(/^\+[\d.]+\s*/, '')
      .replace(/#[\w-]+/g, '')
      .replace(/@[\w\s]+/g, '')
      .trim()
    result.description = desc || 'Income'
  } else if (prefix === '-') {
    result.type = 'expense'
    const amountMatch = trimmed.match(/^-([\d.]+)/)
    if (!amountMatch) { result.error = 'Missing amount after -'; return result }
    result.amount = parseFloat(amountMatch[1])
    result.accountName = accounts[0]
    const desc = trimmed
      .replace(/^-[\d.]+\s*/, '')
      .replace(/#[\w-]+/g, '')
      .replace(/@[\w\s]+/g, '')
      .trim()
    result.description = desc || 'Expense'
  } else {
    result.error = 'Start with - (expense), + (income), or > (transfer)'
  }

  return result
}
