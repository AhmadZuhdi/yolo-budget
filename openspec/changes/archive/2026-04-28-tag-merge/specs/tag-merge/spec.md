## ADDED Requirements

### Requirement: User can merge two tags
The system SHALL allow the user to select a source tag and a target tag, then replace all occurrences of the source tag with the target tag across all committed transactions. After the merge, no transaction SHALL contain the source tag. If a transaction already contains both tags, the source tag SHALL be removed and the target tag SHALL remain (no duplicates).

#### Scenario: Successful merge
- **WHEN** the user selects a source tag and a different target tag and confirms the merge
- **THEN** all committed transactions containing the source tag are updated so the source tag is replaced by the target tag
- **THEN** transactions that already contained both tags end up with only one instance of the target tag
- **THEN** a success toast is shown indicating how many transactions were updated
- **THEN** the source tag no longer appears in the tag dropdowns

#### Scenario: Merge with zero affected transactions
- **WHEN** the user selects a source tag that exists in the dropdown but no committed transactions contain it
- **THEN** the merge completes without error
- **THEN** a success toast is shown with a count of zero transactions updated

#### Scenario: Source equals target is blocked
- **WHEN** the user selects the same tag for both source and target
- **THEN** the confirm button SHALL be disabled
- **THEN** no merge operation is performed

#### Scenario: Affected count preview
- **WHEN** the user selects a source tag
- **THEN** the UI SHALL display the number of committed transactions that contain that tag, before the user confirms

#### Scenario: Empty dropdowns when no tags exist
- **WHEN** no committed transactions with tags exist in the database
- **THEN** both tag dropdowns SHALL be disabled
- **THEN** a "No tags found" message SHALL be displayed
