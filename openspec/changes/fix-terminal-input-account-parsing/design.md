## Context

Terminal input parsing in `stagingStore.ts:121` uses regex `@([\w\s]+?)(?=\s+[@#]|\s+to\s+|fee:|$)` to extract account names. The character class `[\w\s]` consumes whitespace, causing the lazy quantifier to expand through description words when `@account` precedes the description (e.g., `-50 @Cash Groceries #food` → captures `Cash Groceries`). `resolveAccountId()` in `TerminalInput.tsx:242` does exact match only, so `"Cash Groceries"` misses and falls back to `accounts[0]`.

Accounts can be single-word ("Cash", "Bank") or multi-word ("Main Bank"). The fix must preserve multi-word account support.

## Goals / Non-Goals

**Goals:**
- Account extraction stops at word boundaries: `-50 @Cash Groceries #food` → account `"Cash"`
- Multi-word accounts still resolvable: `@Main Bank` → matches "Main Bank"
- Transfers unaffected: `>500 @Bank to @Cash #atm` → from `"Bank"` to `"Cash"`
- `resolveAccountId()` falls back gracefully only when truly ambiguous

**Non-Goals:**
- No changes to `ParsedTerminalInput` interface or DB schema
- No new hooks or store state
- No rework of the staging commit flow

## Decisions

### Decision 1: Restrict regex to word characters, handle multi-word in resolver
**Current**: `@([\w\s]+?)(?=\s+[@#]|\s+to\s+|fee:|$)` — consumes spaces, captures description words.

**Change to**: `@(\w+)` — captures only word characters (no spaces).

**Rationale**: Removes the root cause (space consumption). Multi-word account matching is pushed to `resolveAccountId()` which already has access to the full account list and can try prefix/longest-match. The regex no longer needs the problematic lookahead.

**Alternatives considered**:
- Pass accounts into `parseTerminalInput` for intelligent matching: more correct but changes the pure-function contract, requires refactoring all callers.
- Smarter lookahead that requires account names to be followed by known delimiters: still fragile when description words precede a tag.

### Decision 2: Improve `resolveAccountId()` with prefix matching
**Current**: Exact match only, falls back to `accounts[0].id` on miss.

**Change to**: Try exact match first, then prefix match (e.g., `"Main"` matches `"Main Bank"`), then finally fallback to `accounts[0].id`.

**Rationale**: Covers the `@Main` → `"Main Bank"` case without changing the parser function signature. Prefix match requires the partial name to start at the beginning of the full account name to avoid false positives (e.g., `"Bank"` should NOT match `"Main Bank"` via infix).

**Alternatives considered**:
- Fuzzy / Levenshtein matching: over-engineered for exact user intent. Leading token match is sufficient.
- Case-insensitive substring: too broad (e.g., `"a"` matches everything).

## Risks / Trade-offs

- **[Risk] Multi-word account shorthand ambiguous**: User types `@Main` with accounts `"Main Bank"` and `"Main Savings"`. Prefix match picks the first. → **Mitigation**: Account suggestions in autocomplete help disambiguate. User can type the full name.

- **[Risk] `@to` in transfers**: Regex `@(\w+)` would match `to` as an account name if written as `>500 @Bank to @Cash`. → **Mitigation**: The "to" keyword is handled by the transfer-specific parsing branch (lines 163-181), not the general account regex. The transfer branch uses `accounts[0]` / `accounts[1]` for from/to, and `to` is removed as a keyword in the second `.replace()` on line 179.

- **[Risk] Hyphenated account names**: Account names like `"High-Yield"` use hyphens. → **Mitigation**: Include `-` in the character class: `@([\w-]+)`.

- **[Trade-off] No longer captures arbitrary whitespace in account names**: `@Main Bank` with the new regex captures only `@Main`. But prefix matching in `resolveAccountId()` makes `@Main` resolve to `"Main Bank"`. This is acceptable because autocomplete shows full account names, and users will learn the prefix pattern.
