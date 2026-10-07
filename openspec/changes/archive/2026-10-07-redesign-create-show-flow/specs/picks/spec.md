## ADDED Requirements

### Requirement: Show Access Code Gate
The picks experience SHALL require a valid show access code before a player can make picks for a show that has access-code protection enabled.

#### Scenario: Protected show prompts for code before picks
- **WHEN** a player opens the picks experience for a show with access-code protection enabled
- **THEN** the system requires access-code validation before the player can enter or save picks for that show
- **AND** the picks payload is not created or changed before successful validation

#### Scenario: Correct code grants picks access
- **WHEN** a player submits the correct access code for the selected show
- **THEN** the system allows the player to continue into the picks experience according to existing authentication, location-verification, and pick-locking rules

#### Scenario: Incorrect code blocks picks access
- **WHEN** a player submits an incorrect access code for the selected show
- **THEN** the system does not allow the player to enter or save picks for that show
- **AND** the stored access-code hash is not exposed to the player

#### Scenario: Ungated shows are unchanged
- **WHEN** a player opens or saves picks for a show without access-code protection enabled
- **THEN** existing picks behavior remains unchanged

#### Scenario: Existing submitted picks remain compatible
- **WHEN** access-code protection is added to the system or enabled for an existing show
- **THEN** existing `picks.payload` JSON remains valid
- **AND** submitted picks, scoring, scoreboards, and recalculation behavior are not rewritten or changed by access-code protection

#### Scenario: Review mode remains non-persistent
- **WHEN** an admin or stakeholder uses an approved show review link
- **THEN** review mode remains non-persistent and does not create picks
- **AND** access-code protection does not turn review-mode navigation into a real pick submission flow
