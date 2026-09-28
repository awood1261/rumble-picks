## Purpose

Promotion membership lets BoutPick super admins approve which authenticated accounts can manage a promotion while preserving global super-admin control.

## ADDED Requirements

### Requirement: Approved promotion membership
The system SHALL grant promoter access through explicit promotion membership assigned by a super admin.

#### Scenario: Super admin assigns a user to a promotion
- **WHEN** a super admin assigns an authenticated user to a promotion
- **THEN** the user becomes a member of that promotion
- **AND** receives a role of `owner` or `manager`.

#### Scenario: User is not assigned to any promotion
- **WHEN** an authenticated user has no active promotion memberships
- **THEN** the user does not receive promoter admin access.

#### Scenario: Open self-service promotion creation is unavailable
- **WHEN** an authenticated non-super-admin user signs in
- **THEN** the user cannot create public promotions without super-admin approval or assignment.

### Requirement: Promotion member roles
The system SHALL distinguish promotion membership roles without granting global administration.

#### Scenario: Promotion owner manages assigned promotion
- **WHEN** a promotion owner manages their assigned promotion
- **THEN** the system allows owner-level promotion workflows defined for promotion members
- **AND** does not grant access to unrelated promotions.

#### Scenario: Promotion manager manages assigned promotion
- **WHEN** a promotion manager manages their assigned promotion
- **THEN** the system allows manager-level promotion workflows defined for promotion members
- **AND** does not grant access to unrelated promotions.

#### Scenario: Super admin retains global access
- **WHEN** a super admin uses promotion administration
- **THEN** the system allows managing all promotions independent of promotion membership rows.

### Requirement: Promotion membership lifecycle
The system SHALL let super admins view, add, change, and revoke promotion memberships.

#### Scenario: Super admin views promotion members
- **WHEN** a super admin opens membership management for a promotion
- **THEN** the system shows active members and their roles.

#### Scenario: Super admin changes a member role
- **WHEN** a super admin changes an active member's role
- **THEN** future authorization decisions use the updated role.

#### Scenario: Super admin revokes membership
- **WHEN** a super admin revokes a user's promotion membership
- **THEN** that user no longer has promoter admin access for that promotion.

### Requirement: Promotion-scoped management boundaries
The system SHALL scope promoter management access to assigned promotions.

#### Scenario: Promotion member manages assigned promotion
- **WHEN** a promotion member creates or edits shows, cards, non-destructive results, review links, or promotion roster curation for an assigned promotion
- **THEN** the system permits the operation according to the member's role.

#### Scenario: Promotion member attempts unrelated promotion access
- **WHEN** a promotion member attempts to create, edit, or manage data for an unrelated promotion
- **THEN** the system denies the management operation.

#### Scenario: Promotion member attempts destructive platform operation
- **WHEN** a promotion member attempts destructive operations such as clearing picks/scores or broad data maintenance
- **THEN** the system denies the operation unless the user is also a super admin.
