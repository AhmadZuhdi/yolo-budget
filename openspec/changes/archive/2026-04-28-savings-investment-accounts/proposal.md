## Why

When users move money into savings or investments, it currently records as an expense — reducing net worth on paper even though the money hasn't been spent. Users need a way to reflect "parked" money that is real but not liquid, so the dashboard accurately distinguishes spendable cash from locked-up capital.

## What Changes

- Introduce a `goal` field on accounts to tag them as `savings` or `investment` (existing `type` field already supports these values)
- Add a **Net Worth breakdown** on the Dashboard that splits total balance into **liquid** (cash, bank, credit_card, other) vs **non-liquid** (savings, investment)
- The existing transfer transaction type already correctly models moving money between accounts without treating it as expense or income — educate via UX, not schema changes
- Add a **Savings/Investment summary card** on the Dashboard showing total parked money and individual account balances for savings/investment accounts

## Capabilities

### New Capabilities
- `liquid-vs-nonliquid-networth`: Dashboard net worth card splits balance into liquid and non-liquid totals, so users can see spendable money separately from savings/investments
- `savings-investment-summary`: A dedicated summary section showing savings and investment account balances grouped separately from liquid accounts

### Modified Capabilities
<!-- none — no existing spec-level behavior changes -->

## Impact

- `src/pages/Dashboard.tsx` — extend NetWorthCard or add new card for liquid/non-liquid split
- `src/components/dashboard/NetWorthCard.tsx` — add liquid vs non-liquid breakdown
- `src/hooks/useAccounts.ts` — expose grouped account balances (liquid vs non-liquid)
- No DB schema changes required — `account.type` already has `savings` and `investment` values
- No breaking changes
