## Requirements

### Requirement: Net worth shows liquid and non-liquid subtotals
The system SHALL compute and display two subtotals within the Net Worth card: **Liquid** (accounts of type `cash`, `bank`, `credit_card`, `other`) and **Non-Liquid** (accounts of type `savings`, `investment`). The grand total remains the sum of both.

#### Scenario: Dashboard loads with mixed account types
- **WHEN** the user has at least one liquid account and one savings/investment account
- **THEN** the Net Worth card SHALL display a "Liquid" subtotal and a "Non-Liquid" subtotal below the grand total

#### Scenario: All accounts are liquid
- **WHEN** the user has no savings or investment accounts
- **THEN** the Non-Liquid section SHALL be hidden and only the grand total is shown

#### Scenario: Amounts are hidden
- **WHEN** the user has toggled the eye/hide control
- **THEN** both the grand total and all subtotals SHALL be masked with `••••••`

### Requirement: Account rows are grouped by liquidity in the Net Worth card
The system SHALL render account balance rows grouped under their respective category label (Liquid / Non-Liquid) rather than in a flat list.

#### Scenario: Two groups present
- **WHEN** both liquid and non-liquid accounts exist
- **THEN** account rows SHALL appear under a "Liquid" heading and a "Non-Liquid" heading respectively

#### Scenario: Single group present
- **WHEN** all accounts belong to the same liquidity class
- **THEN** no group heading is shown and rows are rendered as a flat list (current behaviour)
