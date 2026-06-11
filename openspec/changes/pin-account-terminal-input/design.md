## Context

The app provides a terminal-style rapid entry for creating staged transactions. Currently every terminal input must resolve an account: `@AccountName` tokens are matched against account names or the first account is used as fallback. Many users record multiple transactions against the same account in short sessions (e.g., cash wallet or business card). Requiring explicit account tokens for every entry reduces speed and increases friction.

This design introduces a pinned account setting that is used by the terminal input as the default account for new income/expense entries and as the source account for transfers. The setting is stored in the existing `settings` table (key: `pinnedAccountId`) to avoid DB schema migrations.

## Goals / Non-Goals

**Goals:**
- Provide a simple and discoverable way to pin/unpin an account for terminal input.
- Terminal input parser uses pinned account as default for income/expense entries.
- For transfers, the pinned account becomes the `from` account if no `@from` is specified; destination account must still be specified explicitly.
- Keep the change isolated and minimal: reuse existing settings table and the staging store.

**Non-Goals:**
- Automatically pinning accounts based on usage patterns (no heuristics).
- Changing committed transaction behavior or stored transaction schema.

## Decisions

1. Persist pinned account as a settings key `pinnedAccountId` (stringified account id) in `settings` table.
   - Rationale: avoids Dexie schema changes and stays consistent with other flags.
   - Alternative: Add a dedicated `pinnedAccount` table — rejected as heavier and unnecessary.

2. Expose pinned account via `useSettings` hook and a small helper `getPinnedAccount()` which returns an Account or null.
   - Rationale: keeps components simple and testable. `useSettings` already exists and is the natural place.

3. Update `parseTerminalInput()` inside `src/store/stagingStore.ts` to accept an optional `pinnedAccountId` parameter (or read from settings store if not provided) and use it as the default when resolving account tokens.
   - Rationale: centralises parsing logic in the staging store and avoids duplicating logic in UI.

4. For transfer commands (`>` prefix), treat pinned account as the `from` account when no source account is provided. The destination (`to`) must still be explicit with `to @Account`.
   - Rationale: matches user expectation: pinned account is usually the source when moving funds.

5. Add UI affordances:
   - Accounts page: small pin/unpin button on each account card.
   - Terminal input: show a small pill indicating current pinned account with a quick unpin action.
   - Rationale: both places make the feature discoverable and accessible without duplicating settings pages.

## Risks / Trade-offs

- [Risk] Users may forget a pinned account is active and attribute transactions to the wrong account → Mitigation: clearly visible pinned account pill in TerminalInput and a temporary toast when a pinned account is used for an entry ("Using pinned account: Wallet").
- [Risk] Pinned account id could refer to a deleted account → Mitigation: `getPinnedAccount()` should return null if account not found and code should clear the setting when an account is deleted.

## Migration Plan

- No DB migration required. Implementation writes and reads `pinnedAccountId` in `settings` table as a normal key.
- Deploy UI and store changes together. Feature is opt-in — no existing behavior changes until user pins an account.

## Open Questions

- Should pinning be per-device or global across installs? Current approach stores in local settings (IndexedDB) making it per-device — acceptable for now.
