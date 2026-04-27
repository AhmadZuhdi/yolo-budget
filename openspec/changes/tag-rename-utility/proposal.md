## Why

Tags accumulate typos and inconsistencies over time (e.g. `coffe`, `coffees`, `Coffee`) — there is currently no way to rename or merge them across transactions in bulk. A Utilities page provides a home for data-management tools like this, with room to grow.

## What Changes

- Add a new **Utilities** page (`/utilities`) accessible via a link on the **Settings** page (not in the nav bar)
- Add a **Rename Tag** tool on the Utilities page: user picks an existing tag from a dropdown, types a new name, and all transactions that contain the old tag have it replaced with the new name
- The rename is applied to all committed transactions in the DB (bulk update)
- The Utilities page is designed as an expandable container — the tag rename tool is the first entry, more tools can be added later

## Capabilities

### New Capabilities
- `utilities-page`: New route `/utilities` with a dedicated page component; linked from the Settings page (no nav bar entry)
- `tag-rename`: Tool on the Utilities page that bulk-renames a tag across all transactions; shows a preview count before confirming

### Modified Capabilities
<!-- none -->

## Impact

- `src/pages/Utilities.tsx` — new page
- `src/pages/Settings.tsx` — add a "Utilities" link/button that navigates to `/utilities`
- `src/App.tsx` — add `/utilities` route
- `src/hooks/useTransactions.ts` — add `renameTag(oldTag, newTag)` helper
- No changes to Sidebar or BottomNav
- No DB schema changes; updates `transactions.tags` array in-place via Dexie bulk modify
