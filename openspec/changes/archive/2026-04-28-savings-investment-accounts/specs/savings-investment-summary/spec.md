## ADDED Requirements

### Requirement: Dashboard shows a Savings & Investments summary card
The system SHALL display a dedicated card on the Dashboard that lists only savings and investment accounts with their individual balances and a combined total. The card SHALL be hidden when no savings or investment accounts exist.

#### Scenario: User has savings and/or investment accounts
- **WHEN** at least one account of type `savings` or `investment` exists
- **THEN** a "Savings & Investments" card SHALL appear on the Dashboard showing each account's name, colour dot, and balance, plus a combined total

#### Scenario: User has no savings or investment accounts
- **WHEN** no accounts of type `savings` or `investment` exist
- **THEN** the Savings & Investments card SHALL NOT be rendered

#### Scenario: Amounts are hidden
- **WHEN** the global hide-amounts toggle is active
- **THEN** all balances in the Savings & Investments card SHALL be masked with `••••••`

### Requirement: Savings & Investments card respects the hide-amounts toggle
The card SHALL read from the same `hideAmounts` state in `useStagingStore` as all other dashboard cards, ensuring consistent masking behaviour across the dashboard.

#### Scenario: Toggle is activated on the Net Worth card
- **WHEN** the user clicks the eye icon on any dashboard card
- **THEN** the Savings & Investments card SHALL also mask its amounts immediately
