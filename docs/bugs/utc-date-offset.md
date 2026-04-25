# Bug Report: UTC Timezone Offset Causes Off-by-One Date Errors

| Field | Detail |
|---|---|
| **Severity** | High |
| **Affected App** | Yolo Expense Tracker (PWA) |
| **Affected Timezone** | Asia/Jakarta (UTC+7) — any timezone east of UTC is affected |
| **Root Cause** | `Date.toISOString()` used to produce local `YYYY-MM-DD` date strings |
| **Status** | Fixed |

---

## Summary

All date strings for transaction records were produced using `new Date().toISOString().split('T')[0]`. `toISOString()` always serializes to UTC. For users in timezones east of UTC (e.g. UTC+7 Jakarta), any date created before 7:00 AM local time resolves to the **previous calendar day** in UTC. This caused transactions, budget periods, pay cycle boundaries, and recurring occurrences to be stored with an incorrect date — one day behind the user's local date.

The bug was silent: no errors were thrown, data was written successfully, but queries against date ranges returned wrong or empty results.

---

## Background

The app stores transaction dates as `YYYY-MM-DD` strings in IndexedDB (via Dexie.js). Date range queries use lexicographic string comparison, e.g.:

```ts
.where('date').between('2026-04-25', '2026-05-24', true, true)
```

This approach is correct and efficient — but only if the date strings themselves are derived from local time. If they are derived from UTC, the stored values are wrong at the source.

---

## Root Cause

```js
// WRONG — always produces a UTC date string
new Date().toISOString().split('T')[0]
```

`Date.prototype.toISOString()` converts the instant to UTC before formatting. For a user in UTC+7:

| Local time (Jakarta) | UTC equivalent | `toISOString().split('T')[0]` |
|---|---|---|
| Apr 25, 06:00 | Apr 24, 23:00 UTC | `2026-04-24` ← wrong |
| Apr 25, 07:00 | Apr 25, 00:00 UTC | `2026-04-25` ← correct |
| Apr 25, 12:00 | Apr 25, 05:00 UTC | `2026-04-25` ← correct |

Any transaction entered before 7:00 AM local time was stored with yesterday's date. The window of failure equals the UTC offset (7 hours for Jakarta, 5.5 hours for IST, etc.).

---

## Symptoms

1. **Dashboard Pay Cycle card showed `0` income / `0` expense** after entering transactions in the morning — the transactions were stored under the previous day and fell outside the pay cycle range.
2. **Budget spending showed last cycle's data** even after payday (the 25th) — the pay cycle start boundary was computed as `2026-04-24` instead of `2026-04-25`.
3. **Transaction list showed `Apr 24`** for transactions entered on the morning of `Apr 25`.
4. **Pay Cycle date range displayed as `2026-04-24 → 2026-05-23`** instead of `2026-04-25 → 2026-05-24` (off by one day throughout).

---

## Affected Files

Every call site that used `toISOString()` to produce a local `YYYY-MM-DD` string was affected:

| File | Usage |
|---|---|
| `src/components/staging/TransactionFormDialog.tsx` | Default date on form open and after reset |
| `src/components/staging/TerminalInput.tsx` | Fallback `today` date on submit |
| `src/components/transactions/ReconcileDialog.tsx` | Reconcile transaction date |
| `src/pages/Accounts.tsx` | Transfer and quick-add transaction date |
| `src/store/stagingStore.ts` | `d:today`, `d:yesterday`, `d:-N` terminal date resolver |
| `src/utils/recurringEngine.ts` | Next occurrence date after processing a cycle |
| `src/hooks/useRecurring.ts` | First occurrence date on recurring template creation |
| `src/utils/llmExport.ts` | Weekly/yearly budget date range boundaries |
| `src/lib/utils.ts` | `getPaycycleDateRange()` internal `toYMD()` helper |
| `src/hooks/useTransactions.ts` | `getTagSpending()` start/end date boundaries |

---

## Fix

### Primary Fix — Local date helpers in `src/lib/utils.ts`

Two helpers were added to centralise correct local-date production:

```ts
/**
 * Returns today's date as YYYY-MM-DD in the user's local timezone.
 * Use this instead of new Date().toISOString().split('T')[0].
 */
export function todayYMD(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Converts a Date object to YYYY-MM-DD in the user's local timezone.
 * Use this instead of someDate.toISOString().split('T')[0].
 */
export function dateToYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
```

Every instance of `new Date().toISOString().split('T')[0]` was replaced with `todayYMD()`, and every instance of `someDate.toISOString().split('T')[0]` used for a transaction date field was replaced with `dateToYMD(someDate)`.

> **Note:** `toISOString()` is still used correctly for full ISO timestamps — `createdAt`, `exportedAt`, `lastSyncAt` — where UTC is the appropriate representation.

### Secondary Fix — `useBudgets` stale dependency array

`useBudgets` called `useLiveQuery(fn, [])` with an empty dependency array. This meant the query ran once on mount and never re-executed when `paycycleDay` changed (e.g. after settings load). Budget spending was computed with a stale or default paycycle day.

**Fix:** `paycycleDay` is now read from `useSettings()` outside the `useLiveQuery` callback and added to the dependency array:

```ts
// Before
const budgets = useLiveQuery(() => computeBudgets(), [])

// After
const { paycycleDay } = useSettings()
const budgets = useLiveQuery(() => computeBudgets(paycycleDay), [paycycleDay])
```

---

## Data Impact

Transactions entered **before the fix** during early morning hours (before 7:00 AM Jakarta time) are stored with an incorrect date (`YYYY-MM-DD - 1`).

**These records cannot be auto-migrated.** There is no reliable way to distinguish a genuinely previous-day transaction from a UTC-shifted one stored at the wrong date. Affected records must be corrected manually using the transaction edit dialog.

Users who primarily enter transactions after 7:00 AM are unaffected.

---

## Prevention

| Rule | Detail |
|---|---|
| **Never** use `toISOString()` for local date strings | It produces UTC dates, not local dates |
| **Always** use `todayYMD()` for "today" as a date field | Defined in `src/lib/utils.ts` |
| **Always** use `dateToYMD(d)` to convert a `Date` to a date field | Defined in `src/lib/utils.ts` |
| **`toISOString()` is acceptable** for full timestamps | `createdAt`, `lastSyncAt`, `exportedAt`, etc. |

When adding any new feature that writes a `YYYY-MM-DD` date string, import and use `todayYMD` or `dateToYMD` from `src/lib/utils.ts`. Do not inline `new Date().toISOString().split('T')[0]`.

---

## References

- [MDN — `Date.prototype.toISOString()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/toISOString)
- [MDN — `Date.prototype.getFullYear()` / `getMonth()` / `getDate()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/getFullYear) — local-time accessors used in the fix
- `src/lib/utils.ts` — `todayYMD()`, `dateToYMD()`, `getPaycycleDateRange()`
- `src/hooks/useTransactions.ts` — `getTagSpending()`
- `src/hooks/useBudgets.ts` — stale dependency fix
