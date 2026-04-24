import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/db'
import type { Recurring } from '@/db/types'
import { addDays, addWeeks, addMonths, addYears } from 'date-fns'
import { dateToYMD } from '@/lib/utils'

function firstOccurrence(frequency: Recurring['frequency']): string {
  const now = new Date()
  let next: Date
  switch (frequency) {
    case 'daily':   next = addDays(now, 1);   break
    case 'weekly':  next = addWeeks(now, 1);  break
    case 'monthly': next = addMonths(now, 1); break
    case 'yearly':  next = addYears(now, 1);  break
    default:        next = addMonths(now, 1)
  }
  return dateToYMD(next)
}

export function useRecurring() {
  const recurring = useLiveQuery(() =>
    db.recurring.orderBy('nextOccurrence').toArray(), []
  )

  async function addRecurring(data: Omit<Recurring, 'id' | 'createdAt' | 'nextOccurrence'>) {
    return db.recurring.add({
      ...data,
      nextOccurrence: firstOccurrence(data.frequency),
      createdAt: new Date().toISOString(),
    })
  }

  async function updateRecurring(id: number, data: Partial<Recurring>) {
    return db.recurring.update(id, data)
  }

  async function deleteRecurring(id: number) {
    return db.recurring.delete(id)
  }

  async function toggleActive(id: number, isActive: boolean) {
    return db.recurring.update(id, { isActive })
  }

  return {
    recurring: recurring ?? [],
    addRecurring,
    updateRecurring,
    deleteRecurring,
    toggleActive,
  }
}
