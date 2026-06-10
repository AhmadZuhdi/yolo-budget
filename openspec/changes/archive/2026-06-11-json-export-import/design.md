## Context

The app already supports GitHub Gist sync (`src/utils/gistSync.ts`) using the `GistSyncPayload` type. The payload serializes accounts, transactions, budgets, and recurring entries. The `restoreFromPayload` function handles destructive import (clear + bulk insert). The Utilities page (`src/pages/Utilities.tsx`) is the natural home for data management tools — it already has Tag Rename and Tag Merge cards.

The file-based export/import should reuse the same payload type and restore logic to avoid divergence. No server, no API keys, no internet required.

## Goals / Non-Goals

**Goals:**
- Export all user data to a single `.json` file that the user can download and store anywhere
- Import data from a previously exported `.json` file via a file picker
- Show a preview summary (record counts) before committing the import
- Reuse `GistSyncPayload` type and `restoreFromPayload` from gistSync.ts
- Place UI cards on the existing Utilities page

**Non-Goals:**
- No incremental/merge import — import is always destructive (clears and replaces)
- No encryption or password protection of the file
- No scheduled/auto-export
- No cloud storage integration
- No changes to the Gist sync flow

## Decisions

1. **Reuse `restoreFromPayload` from gistSync.ts** instead of duplicating it.
   - Rationale: The restore logic is identical (clear tables, strip IDs, bulk insert, preserve settings). Duplicating it would create a maintenance burden. The function is already exported and has no Gist-specific dependencies.
   - Alternative considered: Create a new `restoreFromFilePayload` copy — rejected to avoid drift.

2. **Create `fileBackup.ts` utility** for the export and import file-handling logic.
   - Export: `exportToJsonFile()` — queries all tables, builds a `GistSyncPayload`, triggers browser download via Blob + anchor click.
   - Import: `importFromJsonFile()` — returns a `GistSyncPayload` from a `File` object (reads with `FileReader` or `response.json()` depending on File API used). The actual restore delegates to `restoreFromPayload`.
   - Rationale: Keeps file I/O separate from UI logic. Easy to test or reuse.

3. **Use native browser APIs only** — `Blob`, `URL.createObjectURL`, `<input type="file">`, `FileReader`.
   - Rationale: Zero new dependencies. These APIs are available in all modern browsers and in the PWA context.

4. **Place UI on Utilities page** as two separate cards ("Export to JSON" and "Import from JSON"), below existing Tag Rename/Merge cards.
   - Rationale: Utilities page is the existing home for data management tools. Keeps Settings focused on preferences and Gist sync.

5. **Import preview** — show a dialog with record counts before confirming.
   - Rationale: Consistent with the existing Gist import pattern (ImportPreviewDialog). Users should see what they're about to import.

6. **Payload version check** — reuse the same `PAYLOAD_VERSION` constant and validation logic from gistSync.
   - Rationale: File exports must be compatible with Gist exports and vice versa. A single version constant ensures both paths validate the same way.

## Risks / Trade-offs

- **Destructive import** → User could lose data if they import the wrong file. Mitigation: Show a clear preview dialog with record counts and a warning that existing data will be replaced.
- **Large JSON files** → Very large datasets could cause memory pressure during `JSON.stringify` / `JSON.parse`. Mitigation: Acceptable for personal finance data (typically <10k records). Not a concern for initial implementation.
- **Reusing `restoreFromPayload` ties file and Gist restore paths together** → If one needs to diverge in the future, they must be decoupled. Mitigation: Acceptable — they serve the same purpose and share the same payload format.
