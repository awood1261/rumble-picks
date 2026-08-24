## Purpose

The Show Lobby is the promotion-scoped entry experience for a single BoutPick
show, helping players understand the event, whether they can participate, and
which action to take next.

## ADDED Requirements

### Requirement: Show Lobby presents event identity first

The system SHALL present the selected show as a mobile-first event lobby with
show artwork and dynamic promotion/show identity as the dominant visual context.

#### Scenario: Show has artwork and promotion branding

- **WHEN** a player opens a show lobby for a show with artwork and promotion
  branding
- **THEN** the lobby presents the show artwork as the primary visual background
- **AND** presents the promotion branding, show name, show date or status, and
  venue name when available.

#### Scenario: Show has missing optional visual data

- **WHEN** a player opens a show lobby for a show without artwork, promotion
  imagery, tagline, venue name, or start time
- **THEN** the lobby remains usable
- **AND** falls back to neutral BoutPick presentation without hardcoded event
  names, cities, venues, or wrestler imagery.

### Requirement: Show Lobby explains BoutPick briefly

The system SHALL include a short fan-game explanation near the main show
identity without introducing an onboarding tutorial or gambling language.

#### Scenario: First-time player opens lobby

- **WHEN** a player opens a show lobby
- **THEN** the lobby communicates that BoutPick is about predicting matches,
  earning points, and competing on a leaderboard.

### Requirement: Show Lobby has one dominant primary action

The system SHALL present one visually dominant primary action based on the
player's current show, authentication, location, pick, and completion state.

#### Scenario: Location verification is required and not satisfied

- **WHEN** a player opens a location-gated show lobby without valid stored
  verification for that show
- **THEN** the primary action prompts the player to verify location before
  entering picks.

#### Scenario: Location verification succeeds

- **WHEN** a player successfully verifies location for a gated show
- **THEN** the primary action area changes to show that picks are unlocked
- **AND** offers the appropriate next picks action when picks are otherwise
  available.

#### Scenario: Signed-in player can make picks

- **WHEN** a signed-in player opens a show lobby for an unlocked show and any
  required location verification is satisfied
- **THEN** the dominant action takes the player to that show's picks flow.

#### Scenario: Signed-in player already has saved picks

- **WHEN** a signed-in player opens a show lobby for a show where the system can
  determine that the player has already saved show-level picks
- **THEN** the dominant action communicates that the player can view or update
  their existing picks while picks remain editable.

#### Scenario: Player is not signed in

- **WHEN** an unauthenticated player opens a show lobby where picks are otherwise
  available
- **THEN** the dominant action directs the player into the existing sign-in or
  profile creation flow for that show.

#### Scenario: Show is locked but not completed

- **WHEN** a player opens a show lobby after picks have locked and the show is
  not marked completed
- **THEN** the dominant action does not offer editable picks
- **AND** directs the player toward the live scoreboard or leaderboard
  experience.

#### Scenario: Show is completed

- **WHEN** a player opens a show lobby for a show marked completed
- **THEN** the dominant action directs the player toward results through the
  existing scoreboard experience.

### Requirement: Show Lobby simplifies location-gate states

The system SHALL present location verification as a concise participation card
using the existing location-gate behavior.

#### Scenario: Location check has not started

- **WHEN** a player opens a gated show lobby before requesting location
- **THEN** the location action explains that the player must verify attendance at
  the venue to unlock picks
- **AND** provides an explicit verification action.

#### Scenario: Location check is in progress

- **WHEN** the browser location check is in progress
- **THEN** the location action communicates that verification is being checked
- **AND** prevents duplicate verification submissions.

#### Scenario: Location verification fails

- **WHEN** the player's location is outside the allowed area, permission is
  denied, the browser cannot provide location, the request times out, accuracy
  is too imprecise, geolocation is unsupported, or show configuration is invalid
- **THEN** the lobby presents a concise failure state matching the failure type
- **AND** offers recovery or retry where the existing gate behavior permits it.

### Requirement: Show Lobby provides secondary leaderboard access

The system SHALL keep scoreboard access available from the show lobby as a
secondary action that does not compete visually with the primary participation
action.

#### Scenario: Player opens lobby

- **WHEN** a player opens a show lobby
- **THEN** the lobby provides a secondary action to the existing show-scoped
  scoreboard route.

### Requirement: Show Lobby compresses championship presentation

The system SHALL present BoutPick Championship status as a compact teaser using
existing championship data when available.

#### Scenario: Championship status is available

- **WHEN** championship status can be loaded for the show's promotion
- **THEN** the lobby presents the current championship state as a compact teaser
- **AND** distinguishes inaugural, defending champion, and vacant states using
  existing championship status data.

#### Scenario: Championship status links to lineage

- **WHEN** a promotion-scoped title or lineage destination is available
- **THEN** the championship teaser provides navigation to the existing title or
  championship experience.

### Requirement: Show Lobby preserves existing domain contracts

The system SHALL preserve existing picks, scoring, authorization, location-gate,
scoreboard, and championship behavior while changing the show lobby
presentation.

#### Scenario: Player enters picks from lobby

- **WHEN** a player enters picks from the redesigned show lobby
- **THEN** the existing show-level picks flow, pick locking rules, location-gate
  guard, and RLS ownership behavior continue to apply.

#### Scenario: Player opens leaderboard from lobby

- **WHEN** a player opens leaderboard access from the redesigned show lobby
- **THEN** the existing show-scoped scoreboard behavior continues to apply.
