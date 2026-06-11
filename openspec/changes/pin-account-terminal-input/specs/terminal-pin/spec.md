## Terminal-Local Default Account (Terminal Pin)

Summary

Provide a terminal-local default account chooser for the rapid-entry TerminalInput UI. The terminal-local default is intended to be a lightweight, per-device/session convenience that speeds up rapid entry without introducing global settings or changes to the database schema.

Goals

- Allow users to pick/unset a default account from the TerminalInput UI quickly.
- Use the selected default when creating income/expense entries that omit an `@account` token.
- For transfers (`>`), if no source account is provided, use the terminal-local default as the source; the destination account must still be explicit with `@Account`.
- Persist the choice locally (localStorage) so it survives page reload on the device but does not create a global cross-install setting.

Scope

- UI: `src/components/staging/TerminalInput.tsx` — add a compact chooser in the Terminal header.
- Behavior: TerminalInput uses local default as fallback when parsing/submitting commands.
- Storage: use localStorage key `terminalPinnedAccountId` (value: account id as string). No DB schema changes.
- Accessibility: chooser must be keyboard-focusable and have sensible aria-labels.

Requirements

1. Choosing Default
   - Users can click the chooser in the TerminalInput header and select one account from the current account list or select "Unset default".
   - After selection, the chooser shows "Default: <AccountName>".

2. Using Default for Rapid Entry
   - For income/expense commands that do not include an `@account` token, TerminalInput uses the terminal-local default account id if set.
   - For transfer commands (`>`), if no source account is explicitly provided, the terminal-local default is used as the source account; the destination must be provided as `to @Account`.
   - If the terminal-local default id refers to a non-existent account (stale), the UI clears the localStorage entry and behaves as though no default is set.

3. Persistence
   - The selection is stored in localStorage at `terminalPinnedAccountId` with a stringified numeric id.
   - Clearing the selection removes that key from localStorage.

4. Non-Goals
   - This feature must not add new server- or DB-side settings, nor modify the `settings` table.
   - No global synchronization between devices is required.

Acceptance Criteria

- UI shows a chooser in TerminalInput header that lists current accounts and an option to unset. Selecting an account updates the chooser label.
- Submitting `-50 Coffee` with default set to `Cash` stages a transaction with `accountId` = Cash.id, type `expense` and amount 50.
- Submitting `>500 to @Bank` with default set to `Cash` stages a transfer from Cash to Bank for 500.
- Submitting a command that specifies `@Account` still respects the explicit @-token and does not use the default.
- If `terminalPinnedAccountId` points to an ID not present in the account list, the key is removed and the chooser shows `(none)`.

Test Scenarios (manual / automated)

1. Choose default
   - Create two accounts: `Cash`, `Bank`.
   - In TerminalInput chooser pick `Cash`. Expect label: `Default: Cash`.

2. Income/Expense fallback
   - With default `Cash`, submit `-20 Coffee` → staged expense with account `Cash`.
   - Submit `+100 Salary @Bank` → staged income with account `Bank` (explicit override).

3. Transfer behaviour
   - With default `Cash`, submit `>50 to @Bank` → staged transfer from `Cash` to `Bank`.
   - Submit `>50 @Bank to @Cash` → staged transfer from `Bank` to `Cash` (explicit wins).

4. Stale pin handling
   - Set localStorage to a non-existent id and reload. Open the chooser: selection is cleared and localStorage key is removed.

Implementation Notes

- Keep parseTerminalInput pure (it continues to extract accountName/toAccountName tokens). Apply the terminal-local fallback in the TerminalInput submit handler to avoid touching the parser.
- UI should be compact and not interfere with the main input area; prefer an inline button with a small dropdown for account selection.
- Use existing toast system sparingly — avoid extra toasts when default used. Visual label is the primary affordance.
