## Context

The terminal input (`TerminalInput.tsx`) already has autocomplete for `@account` (account names) and `#tag` (tag suggestions) via a `getActiveToken()` function that detects the token type at cursor position and shows a dropdown. The `d:` date token is parsed by `parseTerminalInput()` but has no autocomplete — users must know the syntax or get an error.

## Goals / Non-Goals

**Goals:**
- Detect `d:` token in `getActiveToken()` and show date suggestions
- Show preset suggestions: `d:today`, `d:yesterday`, `d:-1`…`d:-30`
- Include a compact inline calendar in the dropdown to pick arbitrary dates
- Selecting any suggestion populates `d:YYYY-MM-DD` in the input
- Preserve all existing autocomplete behavior for `@` and `#`

**Non-Goals:**
- Not adding a new date picker component from a library — reuse existing calendar primitives if available, or build a lightweight inline calendar
- Not changing the `parseTerminalInput()` date resolution logic (it already works)
- Not changing the staging sheet or transaction form date pickers

## Decisions

**Decision 1: Extend `getActiveToken()` to handle `d:` prefix**

Add `d:` as a third token type alongside `@` and `#`. When the active token starts with `d:`, the dropdown shows date suggestions + inline calendar.

Rationale: Reuses the existing autocomplete infrastructure (dropdown positioning, keyboard navigation, suggestion application). Minimal changes to the component.

**Decision 2: Inline calendar is a simple 7×N grid, not a full date picker library**

Build a lightweight JSX inline calendar (month view with day cells, prev/next month navigation) inside the dropdown. No external dependency.

Rationale: A calendar date picker from Radix or react-day-picker would add weight for a small feature. The inline calendar shows ~35 days at a time and only needs month navigation. The existing `dateToYMD()` utility handles formatting.

Alternative considered: Using a native `<input type="date">` — inconsistent styling across browsers and breaks the terminal-like UX.

**Decision 3: Calendar row shows preset shortcuts above it**

The dropdown shows two sections:
1. Quick presets: `today`, `yesterday`, `-1`…`-7` (common relative dates)
2. Inline calendar for arbitrary dates

Rationale: Most date entries are relative (yesterday, -3 days ago). The calendar is for less common cases where users need a specific date far in the past or future.

## Risks / Trade-offs

- [Risk] Inline calendar makes the dropdown taller → Mitigation: Use `max-h` on the dropdown and scroll if needed. Calendar section is collapsible by default.
- [Trade-off] No library means more JSX code for calendar logic (month offset, day grid, today highlighting) — but it's contained in a single component and unlikely to need maintenance.
