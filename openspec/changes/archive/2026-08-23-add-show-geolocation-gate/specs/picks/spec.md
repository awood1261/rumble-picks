## ADDED Requirements

### Requirement: Location-gated picks entry

Current show-level picks SHALL require successful show location verification
before entering or saving picks when the selected show has location verification
enabled.

#### Scenario: Verified player enters gated picks

- **WHEN** a signed-in player opens picks for a location-gated show with valid
  unexpired location verification for that show
- **THEN** the player can enter the picks experience according to existing picks
  authentication and locking rules.

#### Scenario: Unverified player opens gated picks

- **WHEN** a signed-in player opens picks directly for a location-gated show
  without valid location verification for that show
- **THEN** the system does not allow the player to proceed with picks
- **AND** directs the player to complete location verification for that show.

#### Scenario: Unverified player attempts to save gated picks

- **WHEN** a signed-in player attempts to save picks for a location-gated show
  without valid location verification for that show
- **THEN** the save is blocked before writing the show-level pick row.

#### Scenario: Ungated picks are unchanged

- **WHEN** a player opens or saves picks for a show without location
  verification enabled
- **THEN** existing picks behavior remains unchanged.

#### Scenario: Existing submitted picks remain compatible

- **WHEN** the location gate feature is added
- **THEN** existing `picks.payload` JSON remains valid
- **AND** the feature does not require rewriting submitted prediction payloads.
