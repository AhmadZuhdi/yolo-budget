## Why

The terminal quick-entry parser incorrectly captures description words as part of the account name when `@account` appears before the description text (e.g., `-50 @Cash Groceries #food`). The regex `@([\w\s]+?)` consumes whitespace, capturing `Cash Groceries` instead of `Cash`. The fallback `resolveAccountId("Cash Groceries")` returns accounts[0] — a different account than intended. This makes the staging preview show the wrong account, eroding trust in the entry flow.

## What Changes

- **Fix account name extraction** in `parseTerminalInput()` so `@`-prefixed tokens stop at word boundaries and don't consume description text
- **Improve `resolveAccountId()`** to handle partial/prefix matches against known account names, supporting multi-word account names correctly
- Add test scenarios covering edge cases: `@account` before/after description, multi-word account names, transfers with `@from to @to`
- No changes to DB schema or data model

## Capabilities

### New Capabilities
- `terminal-input-account-matching`: How `@`-prefixed tokens are extracted and matched against known account names

### Modified Capabilities
- None — no existing specs to modify

## Impact

- `src/store/stagingStore.ts` — `parseTerminalInput()` account extraction regex
- `src/components/staging/TerminalInput.tsx` — `resolveAccountId()` matching logic
- No DB schema, type, or hook changes
