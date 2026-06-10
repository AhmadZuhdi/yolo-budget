## ADDED Requirements

### Requirement: Export to JSON file

The system SHALL serialize all accounts, transactions, budgets, and recurring entries into a `GistSyncPayload`-formatted JSON file and trigger a browser download.

#### Scenario: Successful export
- **WHEN** user clicks "Export to JSON" on the Utilities page
- **THEN** the browser downloads a file named `yolo-expense-tracker-{YYYY-MM-DD}.json`
- **AND** the file contains a valid JSON object with `version`, `exportedAt`, `accounts`, `transactions`, `budgets`, `recurring` properties
- **AND** settings (githubPat, gistId) are NOT included in the export

#### Scenario: Export with no data
- **WHEN** user clicks "Export to JSON" and all tables are empty
- **THEN** the file still downloads with empty arrays for each table

### Requirement: Import from JSON file

The system SHALL allow the user to pick a `.json` file, parse it, validate the payload version, show a preview, and on confirmation restore all data (destructive).

#### Scenario: Successful import with preview
- **WHEN** user clicks "Import from JSON" and selects a valid `.json` file with version `1`
- **THEN** a preview dialog shows record counts for each table type (accounts, transactions, budgets, recurring)
- **AND** the preview warns that existing data will be replaced

#### Scenario: Confirm import
- **WHEN** user confirms the import preview dialog
- **THEN** all existing accounts, transactions, budgets, and recurring entries are cleared
- **AND** the imported data is bulk-inserted with auto-generated IDs
- **AND** settings (currency, theme, githubPat, gistId, paycycleDay) are preserved

#### Scenario: Invalid version
- **WHEN** user selects a `.json` file with a `version` other than `1`
- **THEN** an error toast is shown: "Incompatible backup version. Expected v1, got v{actual}."
- **AND** no data is modified

#### Scenario: Malformed file
- **WHEN** user selects a file that is not valid JSON or is missing required fields
- **THEN** an error toast is shown describing the parse failure
- **AND** no data is modified

#### Scenario: User cancels import
- **WHEN** the preview dialog is shown and user clicks "Cancel"
- **THEN** the dialog closes and no data is modified

### Requirement: UI placement

The export and import controls SHALL be placed on the Utilities page as distinct card components.

#### Scenario: Export card visible
- **WHEN** user navigates to `/utilities`
- **THEN** a card titled "Export to JSON" is displayed with a download button and description

#### Scenario: Import card visible
- **WHEN** user navigates to `/utilities`
- **THEN** a card titled "Import from JSON" is displayed with a file picker button and description
