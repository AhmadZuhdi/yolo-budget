import { db } from '@/db/db'
import { PAYLOAD_VERSION, restoreFromPayload } from './gistSync'
import type { GistSyncPayload } from '@/db/types'

export async function exportToJsonFile(): Promise<void> {
  const [accounts, transactions, budgets, recurring] = await Promise.all([
    db.accounts.toArray(),
    db.transactions.toArray(),
    db.budgets.toArray(),
    db.recurring.toArray(),
  ])

  const payload: GistSyncPayload = {
    version: PAYLOAD_VERSION,
    exportedAt: new Date().toISOString(),
    accounts,
    transactions,
    budgets,
    recurring,
  }

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `yolo-expense-tracker-${new Date().toISOString().split('T')[0]}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function importFromJsonFile(file: File): Promise<GistSyncPayload> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const payload = JSON.parse(reader.result as string) as GistSyncPayload
        if (payload.version !== PAYLOAD_VERSION) {
          reject(
            new Error(
              `Incompatible backup version. Expected v${PAYLOAD_VERSION}, got v${payload.version}.`
            )
          )
          return
        }
        resolve(payload)
      } catch (err) {
        reject(new Error(`Failed to parse backup file: ${(err as Error).message}`))
      }
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsText(file)
  })
}

export async function importAndRestore(file: File): Promise<void> {
  const payload = await importFromJsonFile(file)
  await restoreFromPayload(payload)
}
