## Why

The Utilities page only supports renaming a single tag across all transactions. Users have no way to consolidate two tags into one — for example, merging `coffee` and `cafe` into a single `coffee` tag — without manually editing every transaction. A tag merge tool eliminates duplicate tags and keeps spending categories clean.

## What Changes

- Add a **Merge Tags** section to the Utilities page alongside the existing Rename Tag card
- User selects a **source tag** (to be removed) and a **target tag** (to keep)
- All committed transactions that contain the source tag have it replaced with the target tag (if not already present)
- Source tag is effectively deleted once no transactions reference it

## Capabilities

### New Capabilities
- `tag-merge`: UI and logic for merging one existing tag into another across all committed transactions

### Modified Capabilities
<!-- No existing spec requirements are changing -->

## Impact

- `src/pages/Utilities.tsx` — new `TagMergeCard` component added to the page
- `src/hooks/useTransactions.ts` — new `mergeTag(source, target)` helper using a Dexie bulk update
- No schema changes, no new DB tables, no routing changes
