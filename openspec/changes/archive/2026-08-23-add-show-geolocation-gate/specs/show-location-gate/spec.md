## Purpose

Show location gates let BoutPick optionally limit a show's prediction entry
experience to players who verify that their device is near the configured
venue, while leaving unrestricted and virtual shows unchanged.

## ADDED Requirements

### Requirement: Optional show-level location gate

The system SHALL allow each show to independently configure whether location
verification is required before entering that show's prediction experience.

#### Scenario: Show does not require location verification

- **WHEN** a player opens or enters picks for a show without location
  verification enabled
- **THEN** the existing show, login, and picks flows continue without a
  location verification step.

#### Scenario: Show requires location verification

- **WHEN** a player chooses to play a show with location verification enabled
- **THEN** the system requires successful location verification before allowing
  entry into that show's picks experience.

### Requirement: Show venue geofence configuration

The system SHALL support show-level venue and geofence configuration sufficient
to verify whether a player is near the show venue.

#### Scenario: Admin configures a gated show

- **WHEN** an administrator creates or edits a location-gated show
- **THEN** the administrator can configure a venue name, optional venue address,
  venue latitude, venue longitude, and permitted radius in meters.

#### Scenario: Required geofence data is missing

- **WHEN** a show has location verification enabled but does not have valid
  venue coordinates or radius
- **THEN** the player-facing flow does not treat the show as successfully
  verifiable.
- **AND** the admin-facing configuration indicates that required geofence
  information is incomplete.

### Requirement: Location request explanation

The system SHALL explain why location is needed before invoking the browser
location permission prompt.

#### Scenario: Verification has not started

- **WHEN** a player reaches the verification step for a gated show
- **THEN** the system explains that location is used to verify attendance for
  that show
- **AND** provides an explicit action to start location verification.

#### Scenario: Player starts verification

- **WHEN** the player selects the verification action
- **THEN** the system requests one-time browser geolocation permission.

### Requirement: One-time browser geolocation check

The system SHALL use a one-time browser location check for MVP attendance
verification.

#### Scenario: Browser returns location

- **WHEN** the browser returns latitude, longitude, and accuracy for the
  player's device
- **THEN** the system compares that location to the configured show venue
  geofence.

#### Scenario: Continued monitoring is not required

- **WHEN** a player successfully verifies location for a gated show
- **THEN** the system does not require continuous location monitoring while the
  player uses the picks experience.

### Requirement: Geofence distance evaluation

The system SHALL determine whether a player is inside the show geofence by
comparing device location distance to the configured venue radius with
reasonable tolerance for browser-reported accuracy.

#### Scenario: Player is inside geofence

- **WHEN** the player's reported location is within the configured venue radius,
  accounting for acceptable accuracy tolerance
- **THEN** the verification succeeds for that show.

#### Scenario: Player is outside geofence

- **WHEN** the player's reported location is outside the configured venue
  radius after applying acceptable accuracy tolerance
- **THEN** the verification fails
- **AND** the player is not allowed into that show's picks experience from the
  gated flow.

#### Scenario: Location accuracy is too poor

- **WHEN** browser-reported accuracy is too imprecise to make a reasonable
  attendance decision
- **THEN** the system treats verification as inconclusive
- **AND** allows the player to retry.

### Requirement: Verification success persistence

The system SHALL remember successful verification for a limited time for the
same browser and show.

#### Scenario: Verified player returns during validity window

- **WHEN** a player who successfully verified for a show returns to that show's
  picks flow before verification expires
- **THEN** the system allows the player to continue without requesting location
  again.

#### Scenario: Verification expires

- **WHEN** stored verification for a show is expired
- **THEN** the system requires location verification again before entering picks
  for that show.

### Requirement: Minimal location data retention

The system SHALL avoid storing exact player location coordinates by default.

#### Scenario: Verification succeeds

- **WHEN** a player's location verification succeeds
- **THEN** the system stores only the minimum verification state needed to
  recognize that the browser verified for the show
- **AND** does not persist exact player latitude or longitude by default.

### Requirement: Location failure states

The system SHALL present distinct, retryable states for common location
verification failures.

#### Scenario: Permission denied

- **WHEN** the player denies browser location permission
- **THEN** the system explains that location permission is needed for this show
- **AND** provides guidance to retry after enabling permission.

#### Scenario: Location unavailable or timed out

- **WHEN** the browser cannot determine location or the request times out
- **THEN** the system explains that location could not be checked
- **AND** allows the player to retry.

#### Scenario: Browser does not support geolocation

- **WHEN** the player's browser does not support browser geolocation
- **THEN** the system explains that this show requires a supported browser for
  location verification.

### Requirement: Gate is product-level attendance verification

The system SHALL treat browser geolocation verification as a product
participation gate, not as tamper-proof security.

#### Scenario: Location gate is evaluated

- **WHEN** the system evaluates a player's browser-provided location
- **THEN** the system uses that location for attendance gating only
- **AND** does not represent the gate as financial, wagering, ticketing, or
  safety-critical enforcement.

#### Scenario: Authorization remains RLS-based

- **WHEN** a location gate is added to a show
- **THEN** existing Supabase Auth and RLS ownership rules remain the database
  authorization boundary for profile and pick writes.
