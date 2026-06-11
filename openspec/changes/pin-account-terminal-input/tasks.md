## 1. Terminal-local pin

- [x] 1.1 Implement terminal-local pinned account stored in localStorage under `terminalPinnedAccountId`.
- [x] 1.2 Use terminal-local pinned account as default for income/expense when no `@account` is provided.
- [x] 1.3 For transfers, use terminal-local pinned account as the source when no source provided; destination must be explicit.

## 2. UI

- [x] 2.1 Add a small chooser in `src/components/staging/TerminalInput.tsx` to pick/unset the default account for terminal input.
- [x] 2.2 Ensure chooser and buttons have aria-labels and keyboard focus.

## 3. Safety & Edge Cases

- [x] 3.1 Handle missing pinned account id (stale localStorage) by clearing local pin when detected.
- [ ] 3.2 On account deletion, consider clearing terminal-local pin if it referred to the deleted account (optional; local pin will be stale and cleared on use).

## 4. Tests & Verification

- [ ] 4.1 Unit tests: TerminalInput behaviour with terminal-local pin (fallback and transfer source).
- [ ] 4.2 Integration test: stage multiple entries without `@account` and verify staged account is the terminal-local pinned account.
- [ ] 4.3 Manual QA checklist: pick/unset default, input entries with/without @account, transfer flows, deleted account behaviour.
