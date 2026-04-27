import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/db'
import type { Transaction } from '@/db/types'
import { startOfMonth, endOfMonth, parseISO } from 'date-fns'
import { getPaycycleDateRange } from '@/lib/utils'

// Local-time YYYY-MM-DD — avoids UTC offset shifting the date
function toYMD(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export interface TransactionFilters {
  accountId?: number
  type?: Transaction['type']
  tags?: string[]
  startDate?: string
  endDate?: string
  committedOnly?: boolean
}

export function useTransactions(filters: TransactionFilters = {}, paycycleDay = 25) {
  const transactions = useLiveQuery(async () => {
    let query = db.transactions.orderBy('date').reverse()

    let results = await query.toArray()

    // Apply filters client-side (IndexedDB compound indexes are limited)
    if (filters.accountId !== undefined) {
      results = results.filter(
        (tx) => tx.accountId === filters.accountId || tx.toAccountId === filters.accountId
      )
    }
    if (filters.type) {
      results = results.filter((tx) => tx.type === filters.type)
    }
    if (filters.tags && filters.tags.length > 0) {
      results = results.filter((tx) =>
        filters.tags!.some((tag) => tx.tags.includes(tag))
      )
    }
    if (filters.startDate) {
      results = results.filter((tx) => tx.date >= filters.startDate!)
    }
    if (filters.endDate) {
      results = results.filter((tx) => tx.date <= filters.endDate!)
    }
    if (filters.committedOnly) {
      results = results.filter((tx) => tx.isCommitted)
    }

    return results
  }, [
    filters.accountId,
    filters.type,
    filters.tags?.join(','),
    filters.startDate,
    filters.endDate,
    filters.committedOnly,
  ])

  // Current month cash flow (excludes transfers)
  const monthlyFlow = useLiveQuery(async () => {
    const now = new Date()
    const start = toYMD(startOfMonth(now))
    const end   = toYMD(endOfMonth(now))

    const txs = await db.transactions
      .where('date')
      .between(start, end, true, true)
      .and((tx) => tx.isCommitted && tx.type !== 'transfer')
      .toArray()

    const income = txs
      .filter((tx) => tx.type === 'income')
      .reduce((s, tx) => s + tx.amount, 0)

    const expense = txs
      .filter((tx) => tx.type === 'expense')
      .reduce((s, tx) => s + tx.amount, 0)

    return { income, expense, net: income - expense }
  }, [])

  // Pay-cycle cash flow (based on configured payday, excludes transfers)
  const paycycleFlow = useLiveQuery(async () => {
    const { start, end } = getPaycycleDateRange(paycycleDay)

    const txs = await db.transactions
      .where('date')
      .between(start, end, true, true)
      .and((tx) => tx.isCommitted && tx.type !== 'transfer')
      .toArray()

    const income = txs
      .filter((tx) => tx.type === 'income')
      .reduce((s, tx) => s + tx.amount, 0)

    const expense = txs
      .filter((tx) => tx.type === 'expense')
      .reduce((s, tx) => s + tx.amount, 0)

    const { start: cycleStart, end: cycleEnd } = getPaycycleDateRange(paycycleDay)
    return { income, expense, net: income - expense, start: cycleStart, end: cycleEnd }
  }, [paycycleDay])

  async function addTransaction(data: Omit<Transaction, 'id' | 'createdAt'>) {
    return db.transactions.add({ ...data, createdAt: new Date().toISOString() })
  }

  async function updateTransaction(id: number, data: Partial<Transaction>) {
    return db.transactions.update(id, data)
  }

  async function deleteTransaction(id: number) {
    return db.transactions.delete(id)
  }

  async function commitTransaction(id: number) {
    return db.transactions.update(id, { isCommitted: true })
  }

  // Get all unique tags used across transactions
  const allTags = useLiveQuery(async () => {
    const txs = await db.transactions.toArray()
    const tagSet = new Set<string>()
    txs.forEach((tx) => tx.tags.forEach((t) => tagSet.add(t)))
    return Array.from(tagSet).sort()
  }, [])

  async function renameTag(oldTag: string, newTag: string): Promise<number> {
    const normalised = newTag.trim().toLowerCase()
    let count = 0
    await db.transactions
      .where('tags')
      .equals(oldTag)
      .modify((tx) => {
        tx.tags = tx.tags.map((t) => (t === oldTag ? normalised : t))
        count++
      })
    return count
  }

  return {
    transactions: transactions ?? [],
    monthlyFlow: monthlyFlow ?? { income: 0, expense: 0, net: 0 },
    paycycleFlow: paycycleFlow ?? { income: 0, expense: 0, net: 0, start: '', end: '' },
    allTags: allTags ?? [],
    addTransaction,
    updateTransaction,
    deleteTransaction,
    commitTransaction,
    renameTag,
  }
}

// Convenience: get spending for a set of tags in a given period
export async function getTagSpending(
  tags: string[],
  period: 'weekly' | 'monthly' | 'yearly',
  paycycleDay = 1
): Promise<number> {
  const now = new Date()
  let start: string
  let end: string = toYMD(now)

  switch (period) {
    case 'weekly':
      start = toYMD(new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()))
      break
    case 'monthly': {
      // Use paycycle range instead of calendar month
      const range = getPaycycleDateRange(paycycleDay)
      start = range.start
      end   = range.end
      break
    }
    case 'yearly':
      start = toYMD(new Date(now.getFullYear(), 0, 1))
      break
  }

  const txs = await db.transactions
    .where('date')
    .between(start, end, true, true)
    .and((tx) => tx.isCommitted && tx.type === 'expense')
    .toArray()

  return txs
    .filter((tx) => tags.some((tag) => tx.tags.includes(tag)))
    .reduce((s, tx) => s + tx.amount, 0)
}

// suppress unused import warning
export { parseISO }
