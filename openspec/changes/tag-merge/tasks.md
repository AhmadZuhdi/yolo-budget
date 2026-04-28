## 1. Hook

- [x] 1.1 Add `mergeTag(source: string, target: string): Promise<number>` to `useTransactions.ts` — load all committed transactions containing source tag, replace source with target in each tags array (deduplicating with `Set`), bulk-update via `db.transactions.bulkPut`, return count of updated rows

## 2. UI Component

- [x] 2.1 Add `TagMergeCard` component in `src/pages/Utilities.tsx`
- [x] 2.2 Add affected-count preview using `useLiveQuery`
- [x] 2.3 Disable confirm button when source equals target, either is empty, or operation is in progress
- [x] 2.4 Show "No tags found" state when dropdown list is empty
- [x] 2.5 On confirm: call `mergeTag`, show `toast.success` with updated count, reset form state

## 3. Integration & Validation

- [x] 3.1 Add `TagMergeCard` to the `Utilities` page JSX below `TagRenameCard`
- [x] 3.2 Run `npm run build` — zero TypeScript errors
- [x] 3.3 Manual smoke test: merge two tags, verify source tag disappears from dropdowns and affected transactions show only the target tag
