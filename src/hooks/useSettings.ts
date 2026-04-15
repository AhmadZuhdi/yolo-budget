import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/db'
import type { SettingKey } from '@/db/types'

export function useSettings() {
  const settings = useLiveQuery(() => db.settings.toArray(), [])

  const settingsMap = Object.fromEntries(
    (settings ?? []).map((s) => [s.key, s.value])
  ) as Partial<Record<SettingKey, string>>

  async function getSetting(key: SettingKey): Promise<string | undefined> {
    const row = await db.settings.get(key)
    return row?.value
  }

  async function setSetting(key: SettingKey, value: string) {
    return db.settings.put({ key, value })
  }

  async function deleteSetting(key: SettingKey) {
    return db.settings.delete(key)
  }

  return {
    settings: settingsMap,
    getSetting,
    setSetting,
    deleteSetting,
    githubPat: settingsMap.githubPat ?? '',
    gistId: settingsMap.gistId ?? '',
    currency: settingsMap.currency ?? 'USD',
    lastSyncAt: settingsMap.lastSyncAt,
    paycycleDay: settingsMap.paycycleDay ? parseInt(settingsMap.paycycleDay, 10) : 25,
  }
}
