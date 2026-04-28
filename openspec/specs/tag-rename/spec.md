## Requirements

### Requirement: User can select an existing tag to rename
The system SHALL present a dropdown of all distinct tags currently present in committed transactions. The user SHALL select one tag as the source ("old tag").

#### Scenario: Tags exist in the database
- **WHEN** the user opens the Tag Rename tool
- **THEN** a dropdown SHALL list all distinct tags from committed transactions in alphabetical order

#### Scenario: No tags exist
- **WHEN** no committed transactions have any tags
- **THEN** the dropdown SHALL be disabled and display a "No tags found" message

### Requirement: Preview shows affected transaction count
After the user selects an old tag, the system SHALL display the number of committed transactions that contain that tag, before the rename is executed.

#### Scenario: Tag is selected
- **WHEN** the user selects a tag from the dropdown
- **THEN** the UI SHALL display "X transactions will be updated" where X is the count of transactions containing that tag

### Requirement: User inputs a new tag name
The system SHALL provide a text input for the new tag name. The input SHALL be trimmed and lowercased before saving.

#### Scenario: New tag name is entered
- **WHEN** the user types a new tag name
- **THEN** the confirm button SHALL become enabled only when the new name is non-empty and different from the old tag

#### Scenario: New name matches existing tag (merge)
- **WHEN** the user types a new name that already exists as another tag
- **THEN** the system SHALL proceed normally — renaming effectively merges the tags

### Requirement: Confirming rename bulk-updates all affected transactions
The system SHALL replace the old tag with the new tag in the `tags` array of every committed transaction that contains the old tag. The update SHALL be performed as a bulk DB operation.

#### Scenario: Successful rename
- **WHEN** the user confirms the rename
- **THEN** all transactions containing the old tag SHALL have it replaced with the new (trimmed, lowercased) tag
- **AND** a success toast SHALL show "Renamed '#old' → '#new' across X transactions"
- **AND** the form SHALL reset to its initial state

#### Scenario: No transactions match (edge case)
- **WHEN** the selected tag no longer exists at confirm time (e.g. deleted between selection and confirm)
- **THEN** a toast SHALL show "No transactions updated" and the form resets
