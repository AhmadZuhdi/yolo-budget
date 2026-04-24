import { db } from '@/db/db'
import type { Recurring, RecurringTemplate } from '@/db/types'
import { addDays, addWeeks, addMonths, addYears, isPast, parseISO } from 'date-fns'
import { dateToYMD } from '@/lib/utils'

function getNextOccurrence(current: string, frequency: Recurring['frequency']): string {
  const date = parseISO(current)
  let next: Date
  switch (frequency) {
    case 'daily':   next = addDays(date, 1);   break
    case 'weekly':  next = addWeeks(date, 1);  break
    case 'monthly': next = addMonths(date, 1); break
    case 'yearly':  next = addYears(date, 1);  break
    default:        next = addMonths(date, 1)
  }
  return dateToYMD(next)
}

function templateToTransaction(template: RecurringTemplate, date: string) {
  return {
    accountId:     template.accountId,
    type:          template.type,
    amount:        template.amount,
    date,
    description:   template.description,
    tags:          template.tags,
    isCommitted:   true,
    toAccountId:   template.toAccountId,
    transferFee:   template.transferFee,
    createdAt:     new Date().toISOString(),
  }
}

/**
 * Called on app load.
 * Finds all active recurring entries whose nextOccurrence is in the past,
 * generates committed transactions, and advances nextOccurrence.
 */
export async function processRecurringTransactions(): Promise<number> {
  const actives = await db.recurring
    .where('isActive')
    .equals(1)   // Dexie stores booleans as 0/1 for indexed fields
    .toArray()
    // also handle non-indexed boolean (filter client-side fallback)
    .then((rows) => rows.filter((r) => r.isActive))

  let generated = 0

  for (const recurring of actives) {
    let next = recurring.nextOccurrence

    // Advance through all missed occurrences (e.g. app not opened for weeks)
    while (isPast(parseISO(next))) {
      const tx = templateToTransaction(recurring.templateTransaction, next)
      await db.transactions.add(tx)
      next = getNextOccurrence(next, recurring.frequency)
      generated++
    }

    // Update nextOccurrence if it changed
    if (next !== recurring.nextOccurrence) {
      await db.recurring.update(recurring.id!, { nextOccurrence: next })
    }
  }

  return generated
}
