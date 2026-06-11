## Why

Terminal input already supports `d:yesterday`, `d:today`, `d:-N`, and `d:YYYY-MM-DD` syntax, but there is no visual feedback or autocomplete for dates. Users must memorize the date syntax or get an error. Showing a date picker when typing `d:` improves discoverability and reduces errors.

## What Changes

- Show an autocomplete dropdown when the user types `d:` in the terminal input, similar to existing `@account` and `#tag` autocomplete
- Suggest preset date tokens: `d:today`, `d:yesterday`, `d:-1` … `d:-30`
- Include a clickable inline mini-calendar within the dropdown to pick any date
- Selecting a date from autocomplete or calendar populates `d:YYYY-MM-DD` in the input

## Capabilities

### New Capabilities
- `date-autocomplete`: Autocomplete suggestions and inline date picker when typing `d:` in the terminal input

### Modified Capabilities
<!-- No existing spec-level changes -->

## Impact

- `src/components/staging/TerminalInput.tsx` — add `d:` token detection to the existing autocomplete system, add date suggestions dropdown with inline calendar
- No DB schema changes, no new dependencies
