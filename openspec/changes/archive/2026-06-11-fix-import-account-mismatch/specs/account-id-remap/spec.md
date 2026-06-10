## ADDED Requirements

### Requirement: Account ID remapping on import
The system SHALL remap old account IDs to newly assigned Dexie auto-increment IDs when restoring from a backup payload. All records referencing account IDs MUST be updated before being written to the database.

#### Scenario: Import preserves account-transaction relationships
- **WHEN** a backup payload with accounts [A(id=1), B(id=3)] and a transaction with accountId=3 is restored
- **THEN** the transaction's accountId SHALL point to the newly assigned ID for account B (not the old ID 3)
- **AND** `computeAccountBalance(B)` SHALL include that transaction in the balance

#### Scenario: Import preserves transfer links
- **WHEN** a backup payload has accounts [A, B] and a transfer transaction with accountId=A, toAccountId=B
- **THEN** both `accountId` and `toAccountId` SHALL be remapped to the new IDs

#### Scenario: Import preserves recurring template account references
- **WHEN** a backup payload has an account and a recurring entry whose template references that account
- **THEN** `recurring.templateTransaction.accountId` SHALL be remapped to the new ID
- **AND** `recurring.templateTransaction.toAccountId` SHALL be remapped if present

#### Scenario: Records with no matching account are left unchanged
- **WHEN** a transaction references an accountId that does not exist in the payload's accounts array
- **THEN** the transaction's accountId SHALL NOT be remapped (left as-is) to avoid data loss

### Requirement: ID mapping is order-preserving
The system SHALL use the order of accounts in the payload array to determine the mapping, since `bulkAdd` returns auto-generated keys in insertion order.

#### Scenario: Mapping matches insertion order
- **WHEN** payload accounts are [A(oldId=5), B(oldId=2), C(oldId=10)]
- **THEN** the mapping SHALL be {5: newIdOfA, 2: newIdOfB, 10: newIdOfC}
- **AND** newIdOfA < newIdOfB < newIdOfC (sequential from bulkAdd)
