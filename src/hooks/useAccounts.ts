import { useLiveQuery } from 'dexie-react-hooks'
import { db, computeAccountBalance } from '@/db/db'
import type { Account, AccountWithBalance } from '@/db/types'

const LIQUID_TYPES: Account['type'][] = ['cash', 'bank', 'credit_card', 'other']

export function useAccounts() {
  const accounts = useLiveQuery(() => db.accounts.orderBy('createdAt').toArray(), [])

  const accountsWithBalance = useLiveQuery(async (): Promise<AccountWithBalance[]> => {
    const accs = await db.accounts.orderBy('createdAt').toArray()
    return Promise.all(
      accs.map(async (acc) => ({
        ...acc,
        balance: await computeAccountBalance(acc.id!),
      }))
    )
  }, [])

  const netWorth = accountsWithBalance?.reduce((sum, a) => sum + a.balance, 0) ?? 0

  const liquidAccounts = (accountsWithBalance ?? []).filter((a) => LIQUID_TYPES.includes(a.type))
  const nonLiquidAccounts = (accountsWithBalance ?? []).filter((a) => !LIQUID_TYPES.includes(a.type))

  const liquidNetWorth = liquidAccounts.reduce((sum, a) => sum + a.balance, 0)
  const nonLiquidNetWorth = nonLiquidAccounts.reduce((sum, a) => sum + a.balance, 0)

  async function addAccount(data: Omit<Account, 'id' | 'createdAt'>) {
    return db.accounts.add({ ...data, createdAt: new Date().toISOString() })
  }

  async function updateAccount(id: number, data: Partial<Account>) {
    return db.accounts.update(id, data)
  }

  async function deleteAccount(id: number) {
    // Also delete all transactions linked to this account
    await db.transactions.where('accountId').equals(id).delete()
    await db.transactions.where('toAccountId').equals(id).delete()
    return db.accounts.delete(id)
  }

  return {
    accounts: accounts ?? [],
    accountsWithBalance: accountsWithBalance ?? [],
    netWorth,
    liquidAccounts,
    nonLiquidAccounts,
    liquidNetWorth,
    nonLiquidNetWorth,
    addAccount,
    updateAccount,
    deleteAccount,
  }
}
