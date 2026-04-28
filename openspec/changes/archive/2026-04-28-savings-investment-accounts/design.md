## Context

The app uses `account.type` (values: `cash`, `bank`, `credit_card`, `savings`, `investment`, `other`) to categorise accounts, but the Dashboard Net Worth card treats all accounts identically — summing everything into one total. Users who transfer money into savings/investment accounts see it correctly modelled (transfer, not expense), but the UI gives no visual separation between spendable (liquid) and parked (non-liquid) money.

`useAccounts` already exposes `accountsWithBalance` (array of accounts with computed balance) and `netWorth` (sum of all). No DB schema changes are needed.

## Goals / Non-Goals

**Goals:**
- Split the Net Worth card into **Liquid** and **Non-Liquid** subtotals
- Group account rows in the card under their respective category
- Add a dedicated **Savings & Investments** summary section on the Dashboard
- Make it visually clear that transfers to savings/investment accounts are the correct workflow (not expenses)

**Non-Goals:**
- New account types or schema changes
- Portfolio tracking, ROI, or interest calculations
- Separate "savings goal" progress bars (different feature)
- Changes to how transactions are recorded or committed

## Decisions

### 1. Liquid vs Non-Liquid classification via `account.type`
**Decision:** `liquid` = `cash | bank | credit_card | other`; `non-liquid` = `savings | investment`

**Rationale:** These type values already exist and carry semantic meaning. No new field needed. `credit_card` is liquid because its balance affects day-to-day spending capacity (negative balance = debt, reduces net worth correctly). `other` defaults to liquid as the safe fallback.

**Alternative considered:** Add a boolean `isLiquid` flag on `Account`. Rejected — adds DB migration and complexity for a distinction already encoded in `type`.

### 2. Computed split lives in `useAccounts` hook
**Decision:** Add `liquidNetWorth` and `nonLiquidNetWorth` computed values to `useAccounts` return, alongside grouped arrays `liquidAccounts` and `nonLiquidAccounts`.

**Rationale:** Keeps all balance computation co-located with the existing `netWorth` derivation. Components stay presentational.

### 3. NetWorthCard shows split inline, not a new card
**Decision:** Extend `NetWorthCard` to show the liquid/non-liquid breakdown below the total, replacing the flat account list with two labelled groups.

**Rationale:** Avoids adding a 3rd card row to a dashboard that's already dense on mobile. The total remains the primary number; the split is secondary context.

### 4. Savings & Investment Summary as a new Dashboard card
**Decision:** Add a `SavingsCard` component in `src/components/dashboard/` that lists only savings/investment accounts with their balances.

**Rationale:** Gives users a dedicated view of parked money without cluttering the net worth card further. Can be hidden like other cards via the eye toggle.

## Risks / Trade-offs

- **credit_card as liquid:** A card with a large negative balance correctly reduces liquid net worth. Users may not expect this. → Mitigation: label as "Liquid (incl. credit)" in the UI tooltip or subtext.
- **`other` defaulting to liquid:** Ambiguous account type. → Acceptable default; users can re-type accounts if needed.
- **No migration needed:** Purely additive UI change — zero risk to stored data.

## Migration Plan

No migration. Purely additive UI + hook changes. Deploy as normal.
