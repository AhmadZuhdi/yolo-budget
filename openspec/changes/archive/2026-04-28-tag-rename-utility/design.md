## Context

Tags on transactions are free-text strings stored as `string[]` in each `Transaction` record. There is no tag registry — tags are derived at query time by scanning all transactions. This means typos and case variants silently coexist (`food`, `Food`, `fodd`). Currently there is no way to fix them in bulk. The app also has no home for data-management / admin tooling — Settings already has sync-related tools, so a new Utilities page is the right separation.

## Goals / Non-Goals

**Goals:**
- New `/utilities` route with a page that is visibly expandable (card-based layout, one tool per card)
- Tag Rename tool: select an existing tag → type a new name → preview affected transaction count → confirm to bulk-update
- Settings page links to `/utilities` — no nav bar entry
- `renameTag(oldTag, newTag)` helper in `useTransactions` (or a standalone hook) that does the Dexie bulk update

**Non-Goals:**
- Tag deletion (different operation, different UX)
- Tag merge UI (rename achieves this — rename two tags to the same new name in two operations)
- Undo / history (toast feedback is sufficient)
- Restricting renames to committed-only transactions (staged transactions are ephemeral, not in DB)

## Decisions

### 1. `renameTag` lives in `useTransactions` hook
**Decision:** Add `renameTag(oldTag: string, newTag: string): Promise<number>` to `useTransactions`, returning the count of updated transactions.

**Rationale:** All DB transaction logic is co-located there. The Utilities page consumes it via the hook. No new hook file needed.

**Alternative:** Standalone `useTagUtils` hook. Rejected — overkill for a single function; can be extracted later if the hook grows too large.

### 2. Bulk update via Dexie `db.transactions.toCollection().modify()`
**Decision:** Use `db.transactions.where('tags').equals(oldTag).modify(tx => { tx.tags = tx.tags.map(...) })` — or a full table scan with client-side filter since Dexie's multi-value index (`*tags`) supports `.equals()`.

**Rationale:** The `*tags` multi-entry index is already defined on the transactions table, so `.where('tags').equals(oldTag)` is an indexed query. `modify()` patches in-place without reading full records into memory.

**Alternative:** `.toArray()` → map → `bulkPut()`. Acceptable but reads all records unnecessarily.

### 3. Preview count before confirm
**Decision:** When the user selects an existing tag, compute affected count live (via `useLiveQuery` or a one-shot query on selection). Show "X transactions will be updated" before the confirm button is enabled.

**Rationale:** Irreversible bulk operation — showing impact before commit reduces mistakes.

### 4. New tag name normalisation
**Decision:** Trim and lowercase the new tag name before saving, consistent with how tags are stored elsewhere in the app (terminal parser lowercases, form dialog lowercases).

## Risks / Trade-offs

- [Rename to existing tag = merge] If the user types a name that already exists as a tag, this is effectively a merge. → Acceptable and useful; no special handling needed.
- [No undo] Bulk DB write is immediate. → Mitigation: show preview count and require explicit confirm; toast on success with count.
- [Staged transactions not affected] Staged (in-memory) transactions won't be updated. → Acceptable — staged transactions are ephemeral.

## Migration Plan

No migration. Additive change only. Deploy as normal.
