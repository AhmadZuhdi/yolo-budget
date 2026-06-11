import { create } from 'zustand'
import { db } from '@/db/db'
import type { StagedTransaction, TransactionType } from '@/db/types'
import { evalAmount, dateToYMD } from '@/lib/utils'

function uuid(): string {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)
}

interface StagingStore {
  staged: StagedTransaction[]
  isOpen: boolean
  hideAmounts: boolean

  // Sheet open/close
  openSheet: () => void
  closeSheet: () => void
  toggleSheet: () => void
  toggleHideAmounts: () => void

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
  hideAmounts: true,

  openSheet: () => set({ isOpen: true }),
  closeSheet: () => set({ isOpen: false }),
  toggleSheet: () => set((s) => ({ isOpen: !s.isOpen })),
  toggleHideAmounts: () => set((s) => ({ hideAmounts: !s.hideAmounts })),

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
    const records = staged.map(({ id: _id, ...tx }) => {
      // Strip undefined optional fields so IndexedDB doesn't choke on them
      const record: Record<string, unknown> = {
        accountId: tx.accountId,
        type: tx.type,
        amount: tx.amount,
        date: tx.date,
        description: tx.description,
        tags: tx.tags,
        isCommitted: true,
        createdAt: now,
      }
      if (tx.toAccountId !== undefined) record.toAccountId = tx.toAccountId
      if (tx.transferFee !== undefined) record.transferFee = tx.transferFee
      return record
    })

    await db.transactions.bulkAdd(records as unknown as Parameters<typeof db.transactions.bulkAdd>[0])
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
  date?: string   // YYYY-MM-DD; undefined = today
  error?: string
}

function resolveDateToken(raw: string): string | null {
  const today = new Date()
  const fmt = (d: Date) => dateToYMD(d)
  const lower = raw.toLowerCase()
  if (lower === 'today') return fmt(today)
  if (lower === 'yesterday') {
    const d = new Date(today); d.setDate(d.getDate() - 1); return fmt(d)
  }
  const relMatch = lower.match(/^-(\d+)$/)
  if (relMatch) {
    const d = new Date(today); d.setDate(d.getDate() - parseInt(relMatch[1])); return fmt(d)
  }
  // full YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  return null
}

export function parseTerminalInput(input: string): ParsedTerminalInput | null {
  let trimmed = input.trim()
  if (!trimmed) return null

  const result: ParsedTerminalInput = {
    type: 'expense',
    amount: 0,
    description: '',
    tags: [],
  }

  // Extract date token (d:...) before other parsing
  const dateTokenMatch = trimmed.match(/(?:^|\s)(d:\S+)/)
  if (dateTokenMatch) {
    const raw = dateTokenMatch[1].slice(2) // strip "d:"
    const resolved = resolveDateToken(raw)
    if (resolved) {
      result.date = resolved
    } else {
      result.error = `Invalid date: ${raw}. Use d:YYYY-MM-DD, d:today, d:yesterday, or d:-N`
      return result
    }
    trimmed = trimmed.replace(dateTokenMatch[1], '').replace(/\s{2,}/g, ' ').trim()
  }

  // Extract tags (#word)
  const tagMatches = trimmed.match(/#[\w-]+/g) ?? []
  result.tags = tagMatches.map((t) => t.slice(1).toLowerCase())

  // Extract accounts (@word — word characters only, no spaces)
  const accounts = Array.from(trimmed.matchAll(/@([\w-]+)/g), (m) => m[1])

  // Extract fee
  const feeMatch = trimmed.match(/fee:([\d.]+)/i)
  if (feeMatch) result.transferFee = parseFloat(feeMatch[1])

  // Determine type from prefix
  const prefix = trimmed[0]

  if (prefix === '>') {
    // Transfer: >500 @Bank to @Cash  or  >(500+200) @Bank to @Cash
    result.type = 'transfer'
    const amountMatch = trimmed.match(/^>([\d.+\-*/()]+)/)
    if (!amountMatch) { result.error = 'Missing amount after >'; return result }
    const evaled = evalAmount(amountMatch[1])
    if (evaled === null) { result.error = `Invalid expression: ${amountMatch[1]}`; return result }
    result.amount = evaled
    result.accountName = accounts[0]
    result.toAccountName = accounts[1]
    // Description = everything between amount and first @/#/fee
    const desc = trimmed
      .replace(/^>[\d.+\-*/()]+\s*/, '')
      .replace(/#[\w-]+/g, '')
      .replace(/@[\w\s]+/g, '')
      .replace(/fee:[\d.]+/gi, '')
      .replace(/\bto\b/gi, '')
      .trim()
    result.description = desc || 'Transfer'
  } else if (prefix === '+') {
    result.type = 'income'
    const amountMatch = trimmed.match(/^\+([\d.+\-*/()]+)/)
    if (!amountMatch) { result.error = 'Missing amount after +'; return result }
    const evaled = evalAmount(amountMatch[1])
    if (evaled === null) { result.error = `Invalid expression: ${amountMatch[1]}`; return result }
    result.amount = evaled
    result.accountName = accounts[0]
    const desc = trimmed
      .replace(/^\+[\d.+\-*/()]+\s*/, '')
      .replace(/#[\w-]+/g, '')
      .replace(/@[\w\s]+/g, '')
      .trim()
    result.description = desc || 'Income'
  } else if (prefix === '-') {
    result.type = 'expense'
    const amountMatch = trimmed.match(/^-([\d.+\-*/()]+)/)
    if (!amountMatch) { result.error = 'Missing amount after -'; return result }
    const evaled = evalAmount(amountMatch[1])
    if (evaled === null) { result.error = `Invalid expression: ${amountMatch[1]}`; return result }
    result.amount = evaled
    result.accountName = accounts[0]
    const desc = trimmed
      .replace(/^-[\d.+\-*/()]+\s*/, '')
      .replace(/#[\w-]+/g, '')
      .replace(/@[\w\s]+/g, '')
      .trim()
    result.description = desc || 'Expense'
  } else {
    result.error = 'Start with - (expense), + (income), or > (transfer)'
  }

  return result
}
