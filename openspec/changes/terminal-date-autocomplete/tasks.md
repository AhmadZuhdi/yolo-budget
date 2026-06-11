## 1. Extend autocomplete detection for d: token

- [x] 1.1 Add `'d'` as a third case in `getActiveToken()` regex so `d:` prefix is detected alongside `@` and `#`
- [x] 1.2 Generate date suggestions in `computeSuggestions()` when `type === 'd'`: presets (`today`, `yesterday`, `-1`…`-30`), month-day named dates if applicable
- [x] 1.3 Filter suggestions based on the partial text after `d:` (e.g., `d:yest` → filter to `yesterday`)

## 2. Build inline calendar component

- [x] 2.1 Create an `InlineCalendar` component (month view, day grid, prev/next month navigation, today highlight)
- [x] 2.2 Add click handler on day cell that applies `d:YYYY-MM-DD` to the input and closes the dropdown
- [x] 2.3 Style the calendar to match the terminal's dark theme (compact, monospace-friendly)

## 3. Integrate date dropdown into TerminalInput

- [x] 3.1 Render the date suggestions and inline calendar inside the existing autocomplete dropdown when `suggestionType === 'd'`
- [x] 3.2 Ensure keyboard navigation (ArrowDown/Up, Tab, Enter, Escape) works for date presets
- [x] 3.3 Apply selected date to input using the same `applySuggestion()` pattern (insert `d:YYYY-MM-DD`)

## 4. Verify

- [x] 4.1 Run `npm run build` to confirm zero TypeScript errors
- [ ] 4.2 Manual test: type `d:` in terminal input and verify dropdown appears with presets and calendar, selecting a date populates the input correctly
