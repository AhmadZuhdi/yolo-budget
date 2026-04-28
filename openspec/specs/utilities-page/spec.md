## Requirements

### Requirement: Utilities page is accessible from Settings
The system SHALL expose a `/utilities` route rendered within the existing `AppLayout`. The Settings page SHALL contain a clearly labelled link or button that navigates to `/utilities`. The Utilities page SHALL NOT appear in the sidebar or bottom nav.

#### Scenario: User navigates to Utilities from Settings
- **WHEN** the user clicks the "Utilities" link on the Settings page
- **THEN** the browser navigates to `/utilities` and the Utilities page is rendered

#### Scenario: Utilities does not appear in navigation
- **WHEN** the user views the sidebar or bottom nav on any page
- **THEN** no Utilities entry SHALL be present

### Requirement: Utilities page uses an expandable card layout
The Utilities page SHALL display tools as individual cards within a scrollable page, so new tools can be added without restructuring the layout.

#### Scenario: Page renders with at least one tool
- **WHEN** the user visits `/utilities`
- **THEN** the page SHALL show a page title and at least one tool card

