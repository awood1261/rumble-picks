## Purpose

Show review links let authorized promoters share a controlled, read-only preview of a BoutPick show with internal or external stakeholders before the show is opened to fans.

## ADDED Requirements

### Requirement: Tokenized show review links
The system SHALL support tokenized show review links that resolve to one promotion-scoped show without exposing admin privileges.

#### Scenario: Admin creates a review link
- **WHEN** an authorized admin creates a review link for a show
- **THEN** the system creates a shareable review URL that resolves to that show
- **AND** associates the link with expiration and revocation state.

#### Scenario: Valid stakeholder link is opened
- **WHEN** a person opens a valid, unexpired, non-revoked review link
- **THEN** the system allows access to that show's review experience without requiring admin access.

#### Scenario: Invalid stakeholder link is opened
- **WHEN** a person opens a missing, unknown, expired, or revoked review link
- **THEN** the system does not expose the show review experience through that link.

#### Scenario: Review link preserves promotion scope
- **WHEN** a review link resolves to a show
- **THEN** the review experience remains scoped to that show's promotion and internal show id.

### Requirement: Review link security boundaries
The system SHALL prevent review links from granting data mutation, admin, scoring, or player privileges.

#### Scenario: Reviewer is not an admin
- **WHEN** a non-admin stakeholder opens a valid review link
- **THEN** the stakeholder can review the show experience
- **AND** cannot create, edit, or delete admin-managed show data.

#### Scenario: Reviewer interacts with review mode
- **WHEN** a reviewer interacts with the show review experience
- **THEN** the interaction does not create a player profile, submit picks, create score records, affect scoreboards, or affect championship eligibility.

#### Scenario: Reviewer opens ordinary fan routes
- **WHEN** a reviewer leaves the tokenized review context and opens ordinary fan-facing routes
- **THEN** normal authentication, location verification, pick locking, and persistence behavior applies.

### Requirement: Review link lifecycle
The system SHALL let authorized admins manage the lifecycle of review links for a show.

#### Scenario: Admin views review links
- **WHEN** an authorized admin reviews links for a show
- **THEN** the system shows enough information to distinguish active, expired, and revoked review links.

#### Scenario: Admin revokes a review link
- **WHEN** an authorized admin revokes a review link
- **THEN** that link no longer grants access to the show review experience.

#### Scenario: Review link expires
- **WHEN** a review link is past its configured expiration
- **THEN** the link no longer grants access to the show review experience.
