## ADDED Requirements

### Requirement: Promotion-scoped admin access
The admin console SHALL support both global super admins and assigned promotion members.

#### Scenario: Super admin opens admin console
- **WHEN** a super admin opens the admin console
- **THEN** the console allows access to all promotions and super-admin-only workflows.

#### Scenario: Promotion member opens admin console
- **WHEN** a user with active promotion membership opens the admin console
- **THEN** the console allows access to assigned promotions only.

#### Scenario: User without admin or membership opens admin console
- **WHEN** an authenticated user without super-admin status and without active promotion membership opens the admin console
- **THEN** the console does not expose promotion management workflows.

### Requirement: Assigned promotion selection
The admin console SHALL present only authorized promotions to promotion members.

#### Scenario: Promotion member has one assigned promotion
- **WHEN** a promotion member has exactly one active promotion membership
- **THEN** the console can default to that promotion.

#### Scenario: Promotion member has multiple assigned promotions
- **WHEN** a promotion member has multiple active promotion memberships
- **THEN** the console lets the member choose among those assigned promotions.

#### Scenario: Promotion member tries direct access to unrelated promotion
- **WHEN** a promotion member attempts to access an unrelated promotion through direct UI state or route parameters
- **THEN** the console does not expose management actions for that promotion.

### Requirement: Scoped show, card, and results workflows
The admin console SHALL scope show setup, card building, and results workflows to the selected authorized promotion.

#### Scenario: Promotion member creates a show
- **WHEN** a promotion member creates a show
- **THEN** the show is created only under an assigned promotion.

#### Scenario: Promotion member builds a card
- **WHEN** a promotion member adds, edits, reorders, or assigns participants for a show card
- **THEN** the operation is limited to shows in assigned promotions.

#### Scenario: Promotion member enters results
- **WHEN** a promotion member enters match results for a show in an assigned promotion
- **THEN** the result workflow remains available according to promotion-scoped authorization.

### Requirement: Super-admin-only destructive operations
The admin console SHALL keep destructive platform operations limited to super admins in the first version.

#### Scenario: Promotion member attempts to clear picks and scores
- **WHEN** a promotion member attempts to clear picks and scores
- **THEN** the console does not allow the operation unless the user is a super admin.

#### Scenario: Promotion member attempts broad data maintenance
- **WHEN** a promotion member attempts broad data maintenance outside an assigned promotion's ordinary setup and results workflows
- **THEN** the console does not allow the operation unless the user is a super admin.

#### Scenario: Super admin performs destructive operation
- **WHEN** a super admin performs a destructive operation
- **THEN** existing confirmation and consequence messaging requirements continue to apply.

### Requirement: Promotion roster admin workflow
The admin console SHALL let promotion members curate the selected promotion's roster from the global wrestler catalog.

#### Scenario: Promotion member views promotion roster
- **WHEN** a promotion member opens roster management for an assigned promotion
- **THEN** the console shows wrestlers currently linked to that promotion roster.

#### Scenario: Promotion member adds catalog wrestler to promotion roster
- **WHEN** a promotion member searches the global catalog and adds a wrestler to an assigned promotion roster
- **THEN** that wrestler is prioritized for that promotion's card-building participant selection.

#### Scenario: Promotion member removes roster wrestler
- **WHEN** a promotion member removes or deactivates a wrestler from an assigned promotion roster
- **THEN** the wrestler is no longer prioritized for new card-building selection for that promotion
- **AND** existing card and scoring references remain valid.
