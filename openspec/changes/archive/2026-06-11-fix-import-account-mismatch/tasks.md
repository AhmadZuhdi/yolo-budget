## 1. Refactor restoreFromPayload with account ID remapping

- [x] 1.1 Capture old account IDs before stripping: save `payload.accounts.map(a => a.id)` into an `oldIds` array before calling `strip()`
- [x] 1.2 Insert accounts sequentially via `bulkAdd` and capture returned new IDs as `newIds`
- [x] 1.3 Build `Map<number, number>` by zipping `oldIds` with `newIds` (skip entries where old id is undefined)
- [x] 1.4 Write a `remapAccountIds(records, idMap, fieldPaths)` helper that walks nested paths (e.g., `accountId`, `toAccountId`, `templateTransaction.accountId`, `templateTransaction.toAccountId`) and remaps values using the map
- [x] 1.5 Apply remapping to `payload.transactions` before bulk-inserting
- [x] 1.6 Apply remapping to `payload.recurring` (nested `templateTransaction`) before bulk-inserting
- [x] 1.7 Insert budgets (unchanged — budgets do not reference account IDs)

## 2. Verify the fix

- [x] 2.1 Run `npm run build` to confirm no TypeScript errors
- [ ] 2.2 Manual verification: export data with 3+ accounts and transactions, clear local data, import the backup, verify that account balances match the original
