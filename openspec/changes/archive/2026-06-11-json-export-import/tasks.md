## 1. Utility function — fileBackup.ts

- [x] 1.1 Create `src/utils/fileBackup.ts` with `exportToJsonFile()` that queries all DB tables, builds a `GistSyncPayload`, and triggers a browser download via Blob + anchor click
- [x] 1.2 Add `importFromJsonFile(file: File): Promise<GistSyncPayload>` that reads a File object, parses JSON, and validates payload version (reuse version constant from gistSync.ts)
- [x] 1.3 Wire `importFromJsonFile` to call `restoreFromPayload` from gistSync.ts for the actual restore

## 2. UI — Export and Import cards on Utilities page

- [x] 2.1 Add "Export to JSON" card to `src/pages/Utilities.tsx` with a download button that calls `exportToJsonFile`
- [x] 2.2 Add "Import from JSON" card to `src/pages/Utilities.tsx` with a hidden `<input type="file">` triggered by a button, that reads the file and shows a preview dialog
- [x] 2.3 Create a simple preview dialog (inline or reused pattern from ImportPreviewDialog) showing record counts and a destructive-import warning before confirming

## 3. Build verification

- [x] 3.1 Run `npm run build` and fix any TypeScript errors
