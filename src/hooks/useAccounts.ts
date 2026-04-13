import { useLiveQuery } from 'dexie-react-hooks'
import { db, computeAccountBalance } from '@/db/db'
import type { Account, AccountWithBalance } from '@/db/types'

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
    addAccount,
    updateAccount,
    deleteAccount,
  }
}
