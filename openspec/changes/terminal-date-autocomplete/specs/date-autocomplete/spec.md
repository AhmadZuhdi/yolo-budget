## ADDED Requirements

### Requirement: Date token autocomplete in terminal input
When the user types `d:` in the terminal input, the system SHALL show an autocomplete dropdown with date suggestions and an inline calendar.

#### Scenario: Dropdown appears on d: token
- **WHEN** the user types `d:` followed by zero or more characters in the terminal input
- **THEN** a dropdown SHALL appear below the cursor showing date suggestions
- **AND** the dropdown SHALL have the same styling and behavior as the existing `@` and `#` autocomplete

#### Scenario: Dropdown shows preset quick dates
- **WHEN** the dropdown is open for a `d:` token
- **THEN** it SHALL show preset options including `today`, `yesterday`, and numbered relative days `-1` through `-7`
- **AND** selecting a preset SHALL insert `d:preset` (e.g., `d:today`, `d:-3`) into the input

#### Scenario: Dropdown includes inline calendar
- **WHEN** the dropdown is open for a `d:` token
- **THEN** it SHALL show a compact inline calendar with:
  - Current month name and year as header
  - Navigation arrows (previous / next month)
  - Day cells in a 7-column grid, starting on Sunday
  - Today's date highlighted
  - Selected date highlighted

#### Scenario: Calendar cell selection inserts date
- **WHEN** the user clicks a day cell in the inline calendar
- **THEN** the input SHALL be updated to `d:YYYY-MM-DD` for the selected date
- **AND** the dropdown SHALL close

#### Scenario: d: token detection works alongside @ and #
- **WHEN** the input contains multiple tokens including `d:`, `@`, and `#`
- **THEN** the `d:` autocomplete SHALL only activate when the cursor is on the `d:` token
- **AND** existing `@` and `#` autocomplete behavior SHALL remain unchanged
