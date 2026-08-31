## Purpose

Defines the promoter/admin console experience for setting up, reviewing, and running BoutPick shows while preserving the current brownfield prediction, scoring, authorization, and data behavior.

## Requirements

### Requirement: Show-First Admin Navigation
The system SHALL present admin operations around a selected promotion-scoped show rather than requiring promoters to start from rumble/event data structures.

#### Scenario: Admin opens the console with shows available
- **WHEN** an authorized admin opens the admin console
- **THEN** the system presents a show-first entry point with the active or selected show, its promotion, show status, and primary workflow areas

#### Scenario: Admin changes the selected show
- **WHEN** an authorized admin selects a different show
- **THEN** the admin workflow areas update to operate on that selected show without changing prediction, scoring, or database contracts

### Requirement: Guided Basic Show Setup
The system SHALL provide a basic show setup workflow for creating or editing a promotion-scoped show with the fields needed for ordinary fan play.

#### Scenario: Admin creates a basic show
- **WHEN** an authorized admin provides the required show identity fields and saves the show
- **THEN** the system creates a promotion-scoped show using the existing show persistence behavior

#### Scenario: Admin edits show details
- **WHEN** an authorized admin edits show details such as name, promotion, image, tagline, start time, registration, lock, featured play, show-over, confidence, or location-gate settings
- **THEN** the system persists those settings using existing show fields and validation behavior

### Requirement: Card Builder Workflow
The system SHALL provide a card-builder workflow for adding, ordering, and editing show-level matches.

#### Scenario: Admin creates a normal match
- **WHEN** an authorized admin adds a standard match to the selected show
- **THEN** the system creates the match and participant sides using the existing match creation behavior

#### Scenario: Admin assigns participants
- **WHEN** an authorized admin assigns wrestlers or entrants to match sides
- **THEN** the system persists those assignments using the existing participant relationship behavior

#### Scenario: Admin reorders card items
- **WHEN** an authorized admin changes the order of matches or other show card items
- **THEN** the system updates their order while preserving existing show card semantics

### Requirement: Readiness Indicators
The system SHALL show readiness indicators that summarize whether a selected show appears ready for fans to view and submit picks.

#### Scenario: Show has complete basic setup
- **WHEN** a selected show has show details, at least one match, participant assignments, and accessible preview routes
- **THEN** the system marks the relevant readiness items as complete

#### Scenario: Show is missing setup data
- **WHEN** a selected show is missing required or expected setup data
- **THEN** the system identifies the missing readiness item without blocking existing admin operations unless existing validation already blocks them

#### Scenario: Location-gated show is incomplete
- **WHEN** a selected show requires location verification but lacks valid venue latitude, longitude, or radius
- **THEN** the system marks the location-gate readiness item as incomplete

### Requirement: Fan-Facing Preview And Share Actions
The system SHALL expose admin actions for opening existing fan-facing show, picks, scoreboard, and QR experiences for the selected show where those routes are available.

#### Scenario: Admin previews the show
- **WHEN** an authorized admin uses the preview action for a selected show
- **THEN** the system opens or links to the existing fan-facing show experience for that show and promotion

#### Scenario: Admin opens picks or scoreboard
- **WHEN** an authorized admin uses picks or scoreboard actions for a selected show
- **THEN** the system opens or links to the existing picks or scoreboard experience without changing submitted picks or score calculations

### Requirement: Live Results Workflow
The system SHALL provide a results workflow optimized for entering and reviewing show results during or after a show.

#### Scenario: Admin enters match results
- **WHEN** an authorized admin records a match winner, finish, match length, interference, or supported special-match result
- **THEN** the system persists the result using existing result fields and preserves existing score recalculation behavior

#### Scenario: Admin reviews result completion
- **WHEN** a selected show has multiple matches
- **THEN** the system shows which matches have results entered and which remain incomplete

### Requirement: Advanced Feature Disclosure
The system SHALL keep advanced domains available without making them the default path for basic show setup.

#### Scenario: Admin needs advanced features
- **WHEN** an authorized admin opens the advanced area
- **THEN** the system provides access to existing advanced domains including rumble events, eliminators, Blind Gauntlet, show questions, confidence points, location gate settings, championship metadata, scoring maintenance, and data maintenance

#### Scenario: Admin follows the basic card workflow
- **WHEN** an authorized admin is creating a normal match card
- **THEN** advanced rumble, eliminator, Blind Gauntlet, scoring maintenance, and destructive data operations are visually secondary to basic show and match setup

### Requirement: Destructive Operation Safeguards
The system SHALL preserve explicit safeguards for destructive admin operations.

#### Scenario: Admin attempts to delete or clear show data
- **WHEN** an authorized admin invokes a destructive operation such as deleting a show or clearing picks and scores
- **THEN** the system requires explicit confirmation and communicates the consequence before performing the operation

### Requirement: Brownfield Behavior Preservation
The redesigned admin console SHALL preserve existing authorization, prediction, scoring, scoreboard, championship, and database behavior unless a separate OpenSpec change explicitly modifies it.

#### Scenario: Existing submitted picks are present
- **WHEN** an authorized admin uses the redesigned console for a show with existing submitted picks
- **THEN** the system does not alter the picks payload shape, ownership behavior, or submitted-pick compatibility as part of the redesign

#### Scenario: Admin uses scoring controls
- **WHEN** an authorized admin recalculates scores or edits results
- **THEN** the system preserves the current application scoring behavior and existing brownfield inconsistency between show-level picks and legacy event-level score persistence

#### Scenario: Admin access is checked
- **WHEN** a user without admin authorization attempts to use admin functionality
- **THEN** the system continues to rely on existing RLS-backed admin authorization and does not introduce a weaker access path
