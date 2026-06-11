## ADDED Requirements

### Requirement: Account token extraction stops at word boundaries

When the terminal input parser extracts `@`-prefixed tokens for account matching, it SHALL capture only word characters (letters, digits, hyphens) and stop at whitespace. It MUST NOT consume description words that follow the `@` token.

#### Scenario: Expense with @account before description

- **WHEN** the input is `-50 @Cash Groceries #food`
- **THEN** the extracted account token SHALL be `"Cash"`

#### Scenario: Expense with @account after description

- **WHEN** the input is `-50 Groceries #food @Cash`
- **THEN** the extracted account token SHALL be `"Cash"`

#### Scenario: Income with @account before description

- **WHEN** the input is `+2000 @Bank Salary #income`
- **THEN** the extracted account token SHALL be `"Bank"`

#### Scenario: Tags before @account

- **WHEN** the input is `-50 #food @Cash Coffee`
- **THEN** the extracted account token SHALL be `"Cash"`

### Requirement: Multi-word account resolution via prefix matching

When `resolveAccountId()` receives a partial account name that does not exactly match any account, it SHALL try a prefix match: check if the partial name matches the start of any account name (case-insensitive, followed by a space or end-of-string). The first matching account SHALL be used.

#### Scenario: Prefix match resolves multi-word account

- **WHEN** an account named `"Main Bank"` exists and the resolved token is `"Main"`
- **THEN** `resolveAccountId("Main")` SHALL return the ID of `"Main Bank"`

#### Scenario: Exact match takes priority over prefix match

- **WHEN** accounts `"Main"` and `"Main Bank"` both exist and the resolved token is `"Main"`
- **THEN** `resolveAccountId("Main")` SHALL return the ID of `"Main"` (exact match wins)

#### Scenario: Fallback to first account when nothing matches

- **WHEN** no account name starts with or equals the resolved token
- **THEN** `resolveAccountId(token)` SHALL return `accounts[0].id`

### Requirement: Transfer parsing unaffected

Transfer transactions (`>` prefix) SHALL continue to extract `@from` and `@to` accounts correctly. The `"to"` keyword SHALL NOT be treated as an account name.

#### Scenario: Transfer with single-word accounts

- **WHEN** the input is `>500 @Bank to @Cash #transfer`
- **THEN** `accountName` SHALL be `"Bank"` and `toAccountName` SHALL be `"Cash"`

#### Scenario: Transfer with multi-word source account

- **WHEN** accounts include `"Main Bank"` and `"Cash"`, and the input is `>500 @Main to @Cash #transfer`
- **THEN** `accountName` SHALL be `"Main"` and `resolveAccountId("Main")` SHALL return `"Main Bank"`'s ID via prefix match

### Requirement: Hyphenated account names supported

Account names containing hyphens SHALL be captured correctly by the token extraction regex.

#### Scenario: Hyphenated account name

- **WHEN** the input is `-100 @High-Yield Deposit #savings`
- **THEN** the extracted account token SHALL be `"High-Yield"`
