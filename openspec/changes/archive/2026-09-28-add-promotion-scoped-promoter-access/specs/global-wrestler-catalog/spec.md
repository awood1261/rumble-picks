## Purpose

The global wrestler catalog treats existing entrants as reusable wrestler identities and lets each promotion curate the subset of wrestlers it commonly books.

## ADDED Requirements

### Requirement: Entrants act as global wrestler catalog
The system SHALL treat existing entrant records as canonical global wrestler identities.

#### Scenario: Existing references use entrant identity
- **WHEN** matches, match entrants, rumble entries, eliminators, gauntlet configuration, picks, scoring, or scoreboards reference a wrestler
- **THEN** those references continue to use the existing entrant identity.

#### Scenario: Global catalog is introduced with existing data
- **WHEN** the global wrestler catalog model is introduced
- **THEN** existing entrant records remain valid
- **AND** existing match, pick, scoring, and scoreboard behavior remains compatible.

#### Scenario: Promotion-specific duplicate wrestler records are avoided
- **WHEN** a promotion wants to use an existing wrestler
- **THEN** the system links the existing global wrestler to the promotion roster instead of requiring a duplicate wrestler record.

### Requirement: Promotion roster curation
The system SHALL allow promotion members to curate a promotion-specific roster from the global wrestler catalog.

#### Scenario: Promotion member adds catalog wrestler to roster
- **WHEN** a promotion member selects a global wrestler for an assigned promotion
- **THEN** the wrestler becomes available in that promotion's roster.

#### Scenario: Promotion member removes wrestler from roster
- **WHEN** a promotion member removes or deactivates a wrestler from an assigned promotion roster
- **THEN** the wrestler is no longer prioritized as part of that promotion's active roster
- **AND** the global wrestler record remains available to other promotions.

#### Scenario: Promotion member searches global catalog
- **WHEN** a promotion member cannot find a wrestler in the selected promotion roster
- **THEN** the system allows searching the global wrestler catalog and adding an existing wrestler to the promotion roster.

### Requirement: Catalog management boundaries
The system SHALL preserve global wrestler catalog data quality while allowing promotion roster curation.

#### Scenario: Super admin edits global wrestler identity
- **WHEN** a super admin edits a global wrestler's canonical name, image, gender, status, or other catalog metadata
- **THEN** the system updates the global wrestler identity used across promotions.

#### Scenario: Promotion member cannot edit canonical identity
- **WHEN** a promotion member manages a promotion roster
- **THEN** the member can add or remove global wrestlers from that promotion roster
- **AND** cannot edit canonical global wrestler identity unless a separate permission is introduced.

#### Scenario: Missing wrestler is needed
- **WHEN** a promotion member needs a wrestler who does not exist in the global catalog
- **THEN** the first version does not require open creation of canonical global wrestler records by promotion members.

### Requirement: Card builder roster prioritization
The system SHALL prioritize the selected promotion's roster during card building while preserving access to the global catalog.

#### Scenario: Promotion member assigns match participants
- **WHEN** a promotion member assigns participants for a show in an assigned promotion
- **THEN** the participant picker prioritizes wrestlers in the selected promotion roster.

#### Scenario: Promotion member uses global wrestler outside roster
- **WHEN** a promotion member selects a global wrestler outside the selected promotion roster
- **THEN** the system allows adding that wrestler to the promotion roster and using them in the card.

#### Scenario: Existing card references remain valid
- **WHEN** a wrestler is removed from a promotion roster after being used on existing cards
- **THEN** existing match, result, pick, scoring, and scoreboard references remain valid because they continue to reference the global entrant identity.
