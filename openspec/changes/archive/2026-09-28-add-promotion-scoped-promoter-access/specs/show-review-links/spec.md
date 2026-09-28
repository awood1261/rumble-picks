## ADDED Requirements

### Requirement: Promotion-scoped review link management
Show review links SHALL be manageable by super admins and by assigned members of the review link's promotion.

#### Scenario: Promotion member creates review link
- **WHEN** a promotion member creates a review link for a show in an assigned promotion
- **THEN** the system creates the review link according to existing tokenized review-link behavior.

#### Scenario: Promotion member views review links
- **WHEN** a promotion member views review links for a show in an assigned promotion
- **THEN** the system shows active, expired, and revoked review links for that show.

#### Scenario: Promotion member revokes review link
- **WHEN** a promotion member revokes a review link for a show in an assigned promotion
- **THEN** that link no longer grants access to the review experience.

#### Scenario: Promotion member attempts unrelated review-link management
- **WHEN** a promotion member attempts to create, view, or revoke review links for an unrelated promotion
- **THEN** the system denies the operation.

#### Scenario: Review link holder opens review experience
- **WHEN** a stakeholder opens a valid review link
- **THEN** existing review-mode access remains token-based and does not grant admin or promotion-member privileges.
