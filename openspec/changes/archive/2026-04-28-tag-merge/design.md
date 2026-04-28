## Context

The Utilities page already has a Tag Rename card that replaces one tag name with another across all committed transactions. The data model stores tags as a `string[]` array on each `Transaction` row in IndexedDB (via Dexie). There is no standalone tags table — tags only exist as values inside transaction rows.

The merge operation is conceptually "rename source → target, then deduplicate". If a transaction already has both `coffee` and `cafe`, after merging `cafe → coffee` it should end up with just `['coffee']`, not `['coffee', 'coffee']`.

## Goals / Non-Goals

**Goals:**
- Allow the user to select a source tag and a target tag from dropdowns populated with existing tags
- Replace every occurrence of source tag with target tag across all committed transactions, deduplicating where both already exist
- Reuse existing `mergeTag` hook logic to keep DB operations consistent

**Non-Goals:**
- Merging more than two tags at once
- Staged (uncommitted) transactions — only committed transactions are in scope (consistent with rename behavior)
- Undo / history of tag operations

## Decisions

**Reuse hook pattern from `renameTag`**
`useTransactions` already exposes `renameTag`. A new `mergeTag(source, target)` function will follow the same pattern: load all committed transactions containing the source tag, bulk-update them with Dexie's `bulkPut`. Deduplication is handled in JS before the write (`new Set(tags)`).

Alternative considered: a separate utility function outside the hook — rejected to keep DB access centralised in hooks.

**Separate UI card, same page**
A new `TagMergeCard` component is added to `Utilities.tsx` below the existing `TagRenameCard`. They share the same page but are visually distinct cards.

Alternative: combine into one card with a mode toggle — rejected for simplicity and discoverability.

**Source ≠ Target validation**
The confirm button is disabled when source equals target, when either is empty, or when an operation is in progress.

## Risks / Trade-offs

- [Large tag sets] If thousands of transactions share a tag, the bulk read + write could be slow → Mitigation: Dexie `bulkPut` is batched efficiently; acceptable for typical personal-finance data volumes.
- [Accidental merge] No undo — user could accidentally merge the wrong tags → Mitigation: show affected transaction count before confirming (same pattern as rename).
