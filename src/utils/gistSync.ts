import { db } from '@/db/db'
import type { GistSyncPayload } from '@/db/types'

const GIST_API = 'https://api.github.com/gists'
const SYNC_FILENAME = 'yolo-expense-tracker-backup.json'
const PAYLOAD_VERSION = 1

// ─── Export ───────────────────────────────────────────────────────────────────

export async function exportToGist(pat: string, gistId: string): Promise<void> {
  const [accounts, transactions, budgets, recurring] = await Promise.all([
    db.accounts.toArray(),
    db.transactions.toArray(),
    db.budgets.toArray(),
    db.recurring.toArray(),
    // NOTE: db.settings is intentionally NOT fetched here.
    // The PAT and Gist ID must never be written to the Gist — doing so
    // would expose the token publicly and cause GitHub to revoke it.
  ])

  const payload: GistSyncPayload = {
    version: PAYLOAD_VERSION,
    exportedAt: new Date().toISOString(),
    accounts,
    transactions,
    budgets,
    recurring,
    // SECURITY: settings (including githubPat) are explicitly excluded from
    // the payload and must never be added here.
  }

  const response = await fetch(`${GIST_API}/${gistId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${pat}`,
      'Content-Type': 'application/json',
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({
      files: {
        [SYNC_FILENAME]: {
          content: JSON.stringify(payload, null, 2),
        },
      },
    }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(
      `GitHub API error ${response.status}: ${(error as { message?: string }).message ?? response.statusText}`
    )
  }

  // Update lastSyncAt
  await db.settings.put({ key: 'lastSyncAt', value: new Date().toISOString() })
}

// ─── Import ───────────────────────────────────────────────────────────────────

export async function importFromGist(pat: string, gistId: string): Promise<GistSyncPayload> {
  const response = await fetch(`${GIST_API}/${gistId}`, {
    headers: {
      Authorization: `Bearer ${pat}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(
      `GitHub API error ${response.status}: ${(error as { message?: string }).message ?? response.statusText}`
    )
  }

  const gist = await response.json() as {
    files: Record<string, { content: string }>
  }

  const file = gist.files[SYNC_FILENAME]
  if (!file) {
    throw new Error(`Backup file "${SYNC_FILENAME}" not found in the Gist.`)
  }

  const payload: GistSyncPayload = JSON.parse(file.content)

  if (payload.version !== PAYLOAD_VERSION) {
    throw new Error(
      `Incompatible backup version. Expected v${PAYLOAD_VERSION}, got v${payload.version}.`
    )
  }

  return payload
}

// ─── Restore (destructive) ────────────────────────────────────────────────────

export async function restoreFromPayload(payload: GistSyncPayload): Promise<void> {
  // Clear all tables (preserve settings like PAT/GistID)
  await Promise.all([
    db.accounts.clear(),
    db.transactions.clear(),
    db.budgets.clear(),
    db.recurring.clear(),
  ])

  // Strip IDs to let Dexie auto-assign — prevents primary key conflicts
  const strip = <T extends { id?: number }>(items: T[]): Omit<T, 'id'>[] =>
    items.map(({ id: _id, ...rest }) => rest as Omit<T, 'id'>)

  await Promise.all([
    db.accounts.bulkAdd(strip(payload.accounts) as Parameters<typeof db.accounts.bulkAdd>[0]),
    db.transactions.bulkAdd(strip(payload.transactions) as Parameters<typeof db.transactions.bulkAdd>[0]),
    db.budgets.bulkAdd(strip(payload.budgets) as Parameters<typeof db.budgets.bulkAdd>[0]),
    db.recurring.bulkAdd(strip(payload.recurring) as Parameters<typeof db.recurring.bulkAdd>[0]),
  ])

  await db.settings.put({ key: 'lastSyncAt', value: new Date().toISOString() })
}

// ─── Create new Gist ─────────────────────────────────────────────────────────

export async function createNewGist(pat: string): Promise<string> {
  const response = await fetch(GIST_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${pat}`,
      'Content-Type': 'application/json',
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({
      description: 'Yolo Expense Tracker Backup',
      public: false,
      files: {
        [SYNC_FILENAME]: {
          content: JSON.stringify({ version: PAYLOAD_VERSION, note: 'Initial placeholder' }),
        },
      },
    }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(
      `Failed to create Gist: ${(error as { message?: string }).message ?? response.statusText}`
    )
  }

  const gist = await response.json() as { id: string }
  return gist.id
}
