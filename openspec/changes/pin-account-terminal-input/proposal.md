## Why

Users frequently enter transactions via the terminal-style rapid entry. Currently the terminal input requires explicitly selecting or typing an account for every entry which is repetitive and slows rapid data entry. Allowing the user to pin a default account for terminal input will streamline the flow for frequent single-account workflows (e.g., recording many expenses from a single wallet) and reduce friction.

## What Changes

- Add a persistent "pinned account" setting used by the terminal input rapid-entry component.
- Terminal input parsing will default the account for new income/expense entries to the pinned account when present.
- For transfers, the pinned account will be used as the "from" account; the destination account must still be specified explicitly in the command.
- UI affordance to pin/unpin an account from the Accounts page and from the terminal input UI.
- Update terminal input parsing and staging store to honour the pinned account and to expose the currently pinned account to the UI.

## Capabilities

### New Capabilities
- `pin-account-terminal-input`: Terminal input can use a pinned default account for income/expense entries and as the source for transfers.

### Modified Capabilities
- `staging-store`: Modify the staging store to read the pinned account from settings and use it when parsing terminal input.

## Impact

- Files likely affected: `src/store/stagingStore.ts`, `src/hooks/useSettings.ts`, `src/components/staging/TerminalInput.tsx`, `src/components/accounts/*` (pin/unpin UI), and possibly `src/hooks/useAccounts.ts` for account lookups.
- Add a new settings key (e.g., `pinnedAccountId`) in `settings` table; update any settings helper to read/write it. This is not a breaking DB change — add as a normal setting entry.
- Tests and UI snapshots touching terminal input and account selection will need updates.
