## Why

Users need a way to export their full financial data as a downloadable JSON file for backup, and import it back when needed — without requiring a GitHub account or internet connectivity. The existing Gist sync requires a PAT and internet, which is a barrier for offline-first users who want simple local file backups.

## What Changes

- Add **Export to JSON** button in Utilities that serializes accounts, transactions, budgets, and recurring entries into a single JSON file and triggers a browser download
- Add **Import from JSON** button in Utilities that opens a file picker, validates the JSON payload, shows a preview summary, and restores all data (destructive — clears existing data first)
- Reuse the existing `GistSyncPayload` type and `restoreFromPayload` logic from `gistSync.ts` (extract shared helpers to avoid duplication)
- New capability: `file-backup` — local JSON file export/import (no server needed)

## Capabilities

### New Capabilities
- `file-backup`: Export all DB tables to a JSON file (download) and import from a JSON file (upload + restore)

### Modified Capabilities

None — no existing specs are being modified.

## Impact

- **New file**: `src/utils/fileBackup.ts` — export to JSON (download) and import from JSON (upload) utilities
- **Modified file**: `src/pages/Utilities.tsx` — add two new cards: Export to JSON and Import from JSON
- **Reused**: `GistSyncPayload` type from `src/db/types.ts`, `restoreFromPayload` logic pattern from `src/utils/gistSync.ts`
- **No new dependencies** — uses native `Blob`, `URL.createObjectURL`, `<a>` download, and `<input type="file">` APIs
- **No schema changes** — payload format matches Gist sync (`GistSyncPayload`)
