## 1. Hook — Extend useAccounts

- [x] 1.1 Add `LIQUID_TYPES` constant (`cash`, `bank`, `credit_card`, `other`) in `useAccounts.ts`
- [x] 1.2 Derive `liquidAccounts` and `nonLiquidAccounts` arrays from `accountsWithBalance`
- [x] 1.3 Compute `liquidNetWorth` and `nonLiquidNetWorth` from the grouped arrays
- [x] 1.4 Export all four new values from `useAccounts` return object

## 2. NetWorthCard — Liquid / Non-Liquid Split

- [x] 2.1 Import `liquidAccounts`, `nonLiquidAccounts`, `liquidNetWorth`, `nonLiquidNetWorth` from `useAccounts` in `NetWorthCard.tsx`
- [x] 2.2 Determine whether both groups are non-empty (need to show split view)
- [x] 2.3 When both groups present: render "Liquid" and "Non-Liquid" labelled subtotals below the grand total
- [x] 2.4 Render account rows under their respective group heading (instead of flat list)
- [x] 2.5 When only one group present: keep existing flat list (no headings, no subtotals)
- [x] 2.6 Ensure all new amounts respect the `hideAmounts` mask

## 3. SavingsCard — New Dashboard Component

- [x] 3.1 Create `src/components/dashboard/SavingsCard.tsx`
- [x] 3.2 Consume `nonLiquidAccounts` and `nonLiquidNetWorth` from `useAccounts`
- [x] 3.3 Consume `hideAmounts` from `useStagingStore`
- [x] 3.4 Render account rows (colour dot, name, balance) and combined total
- [x] 3.5 Return `null` when `nonLiquidAccounts` is empty

## 4. Dashboard — Wire SavingsCard

- [x] 4.1 Import `SavingsCard` in `src/pages/Dashboard.tsx`
- [x] 4.2 Place `<SavingsCard />` after the NetWorth card in the layout

## 5. Build & Verify

- [x] 5.1 Run `npm run build` — zero TypeScript errors
- [x] 5.2 Verify Net Worth card shows grouped rows when savings/investment accounts exist
- [x] 5.3 Verify SavingsCard appears only when savings/investment accounts exist
- [x] 5.4 Verify hide-amounts toggle masks values in both cards
