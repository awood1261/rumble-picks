## ADDED Requirements

### Requirement: Admin show review actions
The admin console SHALL provide actions for opening and sharing a non-persistent show review experience for a selected show.

#### Scenario: Admin opens direct preview
- **WHEN** an authorized admin uses the preview action for a selected show
- **THEN** the system opens the show in review mode rather than requiring the admin to create real picks.

#### Scenario: Admin creates stakeholder review link
- **WHEN** an authorized admin creates a stakeholder review link for a selected show
- **THEN** the system provides a copyable link that can be shared with a non-admin reviewer.

#### Scenario: Admin manages review links
- **WHEN** an authorized admin manages review links for a selected show
- **THEN** the system allows the admin to distinguish active, expired, and revoked links
- **AND** allows active links to be revoked.

#### Scenario: Admin preview preserves normal admin links
- **WHEN** an authorized admin opens normal picks, scoreboard, QR, or fan-facing show links
- **THEN** those links continue to use the existing behavior and do not become review links unless the admin explicitly chooses review mode.

### Requirement: Admin review mode compatibility
The admin console SHALL preserve existing admin, picks, scoring, and show setup behavior when review links are introduced.

#### Scenario: Existing show setup data is unchanged
- **WHEN** an authorized admin creates, opens, copies, or revokes review links
- **THEN** the system does not change match configuration, show questions, entrants, results, submitted picks, scores, scoreboards, or championship data.

#### Scenario: Non-admin attempts review-link management
- **WHEN** a user without admin authorization attempts to create or revoke review links
- **THEN** existing authorization boundaries prevent the management operation.
