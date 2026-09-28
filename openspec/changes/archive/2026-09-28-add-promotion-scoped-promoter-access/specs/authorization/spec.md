## ADDED Requirements

### Requirement: Promotion-scoped authorization model
Authorization SHALL support both global super admins and promotion-scoped members.

#### Scenario: Super admin keeps global authorization
- **WHEN** a user has global super-admin status
- **THEN** the user can perform existing global admin operations.

#### Scenario: Promotion member receives scoped authorization
- **WHEN** a user has active membership for a promotion
- **THEN** the user can perform authorized management operations for that promotion only.

#### Scenario: Non-member attempts promotion management
- **WHEN** an authenticated user without active membership attempts to manage a promotion
- **THEN** authorization denies the operation unless the user is a super admin.

### Requirement: Promotion-scoped RLS boundaries
RLS SHALL enforce promotion membership for browser Supabase writes to promotion-scoped admin data.

#### Scenario: Promotion member writes assigned promotion data
- **WHEN** a promotion member writes admin-managed data scoped to an assigned promotion
- **THEN** RLS permits the write according to the user's membership and role.

#### Scenario: Promotion member writes unrelated promotion data
- **WHEN** a promotion member writes admin-managed data scoped to an unrelated promotion
- **THEN** RLS denies the write.

#### Scenario: Public reads remain available
- **WHEN** public or fan-facing clients read public game data
- **THEN** existing public-read behavior for promotions, shows, cards, scoreboards, and related fan-facing data remains available unless a separate change modifies visibility.

### Requirement: Server privileged access enforces promotion scope
Server-side operations that bypass RLS SHALL perform explicit super-admin or promotion-membership checks before changing promotion-scoped data.

#### Scenario: Server route manages promotion-scoped data
- **WHEN** a server route uses privileged Supabase access to create, update, revoke, or delete promotion-scoped data
- **THEN** the route verifies that the caller is a super admin or an active member of the affected promotion before performing the operation.

#### Scenario: Server route validates public or token access
- **WHEN** a server route validates public review or fan-facing access
- **THEN** the route returns only the limited eligibility data required by that flow
- **AND** does not grant management privileges.

#### Scenario: Unauthorized server request
- **WHEN** a caller lacks super-admin status and lacks membership for the affected promotion
- **THEN** privileged server routes deny promotion-scoped management operations.

### Requirement: Submitted-pick and scoring authorization preservation
Promotion-scoped promoter access SHALL NOT change player-owned picks, scoring source of truth, or public scoreboard authorization.

#### Scenario: Existing picks are present
- **WHEN** promotion-scoped authorization is introduced
- **THEN** existing `picks.payload` values and pick ownership rules remain valid.

#### Scenario: Scoreboards calculate scores
- **WHEN** scoreboards load after promotion-scoped authorization is introduced
- **THEN** existing scoreboard read and calculation behavior remains unchanged.

#### Scenario: Scoring rules are applied
- **WHEN** results are entered by an authorized promotion member
- **THEN** current application scoring rules and recalculation behavior remain unchanged unless a separate scoring change modifies them.
