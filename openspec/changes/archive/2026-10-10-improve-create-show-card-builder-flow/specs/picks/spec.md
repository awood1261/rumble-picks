## ADDED Requirements

### Requirement: Planned Match Slots Do Not Affect Picks
The picks experience SHALL generate prediction UI only from real configured show records and SHALL ignore virtual planned match slots.

#### Scenario: Show has planned count but no real matches
- **WHEN** a player opens picks for a show that has a planned match count but no real match records
- **THEN** the system does not render match prediction steps for virtual planned slots
- **AND** does not create `match_picks`, `match_confidence_picks`, `match_finish_picks`, `match_length_picks`, `match_interference_picks`, or `blind_gauntlet_picks` entries for virtual slots

#### Scenario: Show has planned slots and real matches
- **WHEN** a player opens or saves picks for a show with both real matches and virtual planned slots
- **THEN** the system renders and saves predictions only for real match, event, eliminator, and show-question records
- **AND** the planned count does not alter existing pick payload shape

#### Scenario: Existing submitted picks remain valid
- **WHEN** planned match count is added to an existing show
- **THEN** existing `picks.payload` JSON remains valid
- **AND** no submitted pick payload is rewritten solely because planned count exists or changes

#### Scenario: Planned count changes after picks exist
- **WHEN** an admin changes planned match count after players have submitted picks
- **THEN** existing pick payloads remain associated with real record ids
- **AND** virtual slot additions or removals do not create, remove, or invalidate prediction payload entries
