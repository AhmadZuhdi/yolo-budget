## 1. Hook — Add renameTag to useTransactions

- [x] 1.1 Add `renameTag(oldTag: string, newTag: string): Promise<number>` to `useTransactions.ts`
- [x] 1.2 Implement using `db.transactions.where('tags').equals(oldTag).modify()` to replace the tag in-place
- [x] 1.3 Return count of modified transactions
- [x] 1.4 Export `renameTag` from `useTransactions` return object

## 2. Utilities Page

- [x] 2.1 Create `src/pages/Utilities.tsx` with page title and card-based layout
- [x] 2.2 Build `TagRenameCard` component inside the page (inline, not a separate file)
- [x] 2.3 Fetch all distinct tags via `useLiveQuery` scanning committed transactions
- [x] 2.4 Render tag dropdown (Select) populated with sorted distinct tags; show disabled state when no tags
- [x] 2.5 On tag selection, compute and display affected transaction count ("X transactions will be updated")
- [x] 2.6 Render new tag name input (text Input); trim + lowercase on submit
- [x] 2.7 Enable confirm button only when new name is non-empty and differs from old tag
- [x] 2.8 On confirm: call `renameTag`, show success toast `"Renamed '#old' → '#new' across X transactions"` or "No transactions updated", reset form

## 3. Routing

- [x] 3.1 Add `import Utilities from '@/pages/Utilities'` and `<Route path="/utilities" element={<Utilities />} />` in `src/App.tsx`

## 4. Settings — Link to Utilities

- [x] 4.1 Add a "Utilities" section or button in `src/pages/Settings.tsx` that navigates to `/utilities` (use `useNavigate` or `<Link>`)

## 5. Build & Verify

- [x] 5.1 Run `npm run build` — zero TypeScript errors
- [x] 5.2 Verify `/utilities` route renders correctly with the Tag Rename card
- [x] 5.3 Verify Settings page has a working link to `/utilities`
