import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/db'
import type { Budget, BudgetWithSpending } from '@/db/types'
import { getTagSpending } from './useTransactions'

export function useBudgets() {
  const budgetsWithSpending = useLiveQuery(async (): Promise<BudgetWithSpending[]> => {
    const budgets = await db.budgets.orderBy('createdAt').toArray()
    const paycycleSetting = await db.settings.get('paycycleDay')
    const paycycleDay = paycycleSetting ? parseInt(paycycleSetting.value, 10) : 1

    return Promise.all(
      budgets.map(async (budget) => {
        const spent = await getTagSpending(budget.targetTags, budget.period, paycycleDay)
        const percentage = budget.limitAmount > 0
          ? Math.min((spent / budget.limitAmount) * 100, 999)
          : 0
        const status: BudgetWithSpending['status'] =
          percentage >= 100 ? 'danger' : percentage >= 75 ? 'warning' : 'safe'
        return { ...budget, spent, percentage, status }
      })
    )
  }, [])

  async function addBudget(data: Omit<Budget, 'id' | 'createdAt'>) {
    return db.budgets.add({ ...data, createdAt: new Date().toISOString() })
  }

  async function updateBudget(id: number, data: Partial<Budget>) {
    return db.budgets.update(id, data)
  }

  async function deleteBudget(id: number) {
    return db.budgets.delete(id)
  }

  return {
    budgets: budgetsWithSpending ?? [],
    addBudget,
    updateBudget,
    deleteBudget,
  }
}
