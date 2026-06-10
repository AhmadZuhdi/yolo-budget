## Why

When importing a backup (from JSON file or GitHub Gist), accounts get new auto-increment IDs from Dexie, but transactions and recurring templates still reference the old account IDs. This causes transactions to point to wrong accounts and account balances to be incorrect after import.

## What Changes

- Fix `restoreFromPayload()` in `gistSync.ts` to remap old account IDs to new IDs after bulk-inserting accounts
- Update all foreign-key references in transactions (`accountId`, `toAccountId`) and recurring templates (`templateTransaction.accountId`, `templateTransaction.toAccountId`)
- Add tests or manual verification steps for the mapping logic

## Capabilities

### New Capabilities
- `account-id-remap`: Logic to map old account IDs to newly assigned IDs and update all dependent records (transactions, recurring) after a bulk restore

### Modified Capabilities
<!-- No existing capabilities are changing at the spec level -->

## Impact

- `src/utils/gistSync.ts` — `restoreFromPayload()` needs ID remap logic
- `src/utils/fileBackup.ts` — unchanged (calls `restoreFromPayload`)
- `src/pages/Utilities.tsx` — unchanged (calls `restoreFromPayload`)
- `src/pages/Settings.tsx` — unchanged (calls `restoreFromPayload`)
- Account balance computation will automatically be correct once IDs are remapped
