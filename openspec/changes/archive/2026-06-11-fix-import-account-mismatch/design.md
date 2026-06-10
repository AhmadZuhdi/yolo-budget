## Context

`restoreFromPayload()` in `gistSync.ts` clears all tables and re-inserts data with stripped IDs. Dexie auto-assigns new sequential IDs to accounts, but transactions and recurring templates still use the old account IDs. This breaks the foreign-key relationship, causing transactions to reference wrong accounts and producing incorrect balance computations.

Both import paths call `restoreFromPayload()`:
- **JSON file import** (`Utilities.tsx` → `importAndRestore` → `restoreFromPayload`)
- **GitHub Gist import** (`Settings.tsx` → `ImportPreviewDialog` → `restoreFromPayload`)

## Goals / Non-Goals

**Goals:**
- Remap old account IDs to new IDs after bulk-inserting accounts
- Update `transaction.accountId`, `transaction.toAccountId`, and `recurring.templateTransaction.accountId`/`toAccountId` with new IDs
- Maintain the same approach (strip IDs, bulk insert) — no schema changes

**Non-Goals:**
- Not changing the export format or Gist sync payload structure
- Not modifying the balance computation logic (it works correctly once IDs are correct)
- Not introducing breaking schema changes

## Decisions

**Decision 1: Insert accounts first, remap, then insert dependent records**

Instead of running 4 parallel `bulkAdd` calls, insert accounts first, capture the ID mapping, update dependent records, then insert transactions and recurring entries.

Rationale: The current parallel approach cannot capture the old→new ID mapping since all inserts happen simultaneously and IDs are stripped. Sequential inserts with explicit remapping is the minimal fix.

Alternative considered: Insert into a temporary table, then use SQL-like join. Overly complex for this use case.

**Decision 2: Build a Map<number, number> from the bulkAdd return value**

`Dexie.Table.bulkAdd()` returns an array of the auto-generated primary keys in the same order as the input array. By zipping this with the original payload accounts, we get a correct `oldId → newId` mapping.

**Decision 3: Only remap accounts that still exist in the payload**

If a transaction references an `accountId` that does not correspond to any account in the payload (shouldn't happen, but defensive), skip remapping for that ID and leave it as-is. This prevents runtime crashes on corrupted backups.

## Risks / Trade-offs

- [Risk] Non-sequential or non-contiguous IDs in payload could cause incorrect mapping if order changes → Mitigation: We use a deterministic Map (oldId → newId) based on the payload order, which is always the same as the export order.
- [Risk] The `strip()` function removes all `id` fields, so we must capture the old IDs before stripping → Mitigation: Save old IDs in a parallel array or map before calling `strip()`.
- [Trade-off] We lose parallelism (4 simultaneous bulkAdd → sequential), but for typical backup sizes (<10k records) the performance difference is negligible.
