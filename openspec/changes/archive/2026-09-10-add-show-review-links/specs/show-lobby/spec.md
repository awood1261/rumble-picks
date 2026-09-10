## ADDED Requirements

### Requirement: Show Lobby review mode entry
The show lobby SHALL support a valid review context that identifies the page as a non-persistent review experience and routes the reviewer into review mode.

#### Scenario: Valid review link opens the lobby
- **WHEN** a reviewer opens a valid review link for a show
- **THEN** the lobby presents the selected show using the existing show identity presentation
- **AND** clearly indicates that the reviewer is viewing a review or preview experience.

#### Scenario: Review mode continues to show review flow
- **WHEN** a reviewer uses the lobby primary action in a valid review context
- **THEN** the system routes the reviewer to the non-persistent show review flow for that same show.

#### Scenario: Invalid review context opens the lobby
- **WHEN** a reviewer opens the lobby with an invalid review context
- **THEN** the system does not use review mode to bypass ordinary player requirements.

### Requirement: Show Lobby review geolocation bypass
The show lobby SHALL bypass location verification only inside a valid review context.

#### Scenario: Location-gated show is opened with valid review link
- **WHEN** a valid review link opens a show that requires location verification
- **THEN** the lobby allows review-mode continuation without requesting or requiring browser geolocation.

#### Scenario: Location-gated show is opened normally
- **WHEN** a player opens the same location-gated show outside a valid review context
- **THEN** the existing location verification behavior remains unchanged.

#### Scenario: Review mode bypass does not store verification
- **WHEN** a reviewer bypasses location verification through review mode
- **THEN** the system does not store a reusable player location verification for that reviewer.
