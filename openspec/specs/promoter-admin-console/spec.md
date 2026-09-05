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

### Requirement: Mobile Admin Navigation Conserves Vertical Space
The admin console SHALL provide a mobile navigation experience that keeps the selected admin workflow visible without rendering the full desktop left panel ahead of the page content.

#### Scenario: Admin opens the console on a mobile viewport
- **WHEN** an authorized admin opens the admin console on a mobile-sized viewport
- **THEN** the system presents compact navigation and context controls without requiring the promoter to scroll past the full desktop left panel before seeing the selected admin view

#### Scenario: Admin changes sections on mobile
- **WHEN** an authorized admin selects Dashboard, Shows, Card Builder, Results, Scoreboard, or Advanced/More on a mobile-sized viewport
- **THEN** the selected section becomes visually identifiable and its content remains near the top of the screen

#### Scenario: Admin needs promotion or show context on mobile
- **WHEN** an authorized admin uses the mobile admin console
- **THEN** the active promotion and selected show remain available or clearly summarized without occupying the same vertical space as the desktop sidebar

#### Scenario: Admin uses desktop viewport
- **WHEN** an authorized admin opens the admin console on a desktop-sized viewport
- **THEN** the existing desktop sidebar navigation remains available and does not regress because of the mobile navigation changes

### Requirement: Mobile Admin Navigation Preserves Admin Behavior
The mobile admin navigation change SHALL preserve existing admin functionality, authorization, and data contracts.

#### Scenario: Admin switches views on mobile
- **WHEN** an authorized admin switches between admin views on a mobile-sized viewport
- **THEN** the system preserves the currently selected promotion and show using the existing admin state behavior

#### Scenario: Admin performs existing operations after mobile navigation
- **WHEN** an authorized admin creates or edits shows, builds cards, enters results, opens scoreboards, or uses advanced tools after navigating on mobile
- **THEN** those operations use the existing Supabase/RLS-backed data-access behavior and persistence contracts

#### Scenario: Non-admin attempts access
- **WHEN** a user without admin authorization attempts to access admin functionality
- **THEN** the existing admin access behavior remains unchanged

### Requirement: Guided Basic Show Setup
The system SHALL provide a basic show setup workflow for creating or editing a promotion-scoped show with the fields needed for ordinary fan play.

#### Scenario: Admin creates a basic show
- **WHEN** an authorized admin provides the required show identity fields and saves the show
- **THEN** the system creates a promotion-scoped show using the existing show persistence behavior

#### Scenario: Admin edits show details
- **WHEN** an authorized admin edits show details such as name, promotion, image, tagline, start time, registration, lock, featured play, show-over, confidence, or location-gate settings
- **THEN** the system persists those settings using existing show fields and validation behavior

### Requirement: Card Builder Workflow
The system SHALL provide a card-builder workflow for adding, ordering, reviewing, and editing show-level matches around an ordered wrestling card rather than an always-expanded record-editing surface.

#### Scenario: Admin reviews the match card
- **WHEN** an authorized admin opens Card Builder for a selected show
- **THEN** the system presents the show's matches as ordered match summaries with match number, match type, participant sides, participant imagery where available, championship or main-event indicators where applicable, readiness status, and edit actions

#### Scenario: Admin creates a normal match
- **WHEN** an authorized admin adds a standard match to the selected show
- **THEN** the system creates the match and participant sides using the existing match creation behavior

#### Scenario: Admin edits one match
- **WHEN** an authorized admin opens a match for editing
- **THEN** the system provides a focused editing surface for that match without requiring all matches on the card to remain expanded

#### Scenario: Admin assigns participants
- **WHEN** an authorized admin assigns wrestlers or entrants to match sides
- **THEN** the system persists those assignments using the existing participant relationship behavior

#### Scenario: Admin reorders card items
- **WHEN** an authorized admin changes the order of matches or other show card items
- **THEN** the system updates their order while preserving existing show card semantics

#### Scenario: Admin uses participant imagery
- **WHEN** a match side contains entrants with stored images
- **THEN** the system uses those entrant images to represent the participants by default without requiring the admin to provide image URLs

#### Scenario: Admin customizes side presentation
- **WHEN** an authorized admin needs to override a side name or side image
- **THEN** the system keeps side label and side image editing available as optional match configuration

### Requirement: Readiness Indicators
The system SHALL show readiness indicators that summarize whether a selected show and its card appear ready for fans to view and submit picks.

#### Scenario: Show has complete basic setup
- **WHEN** a selected show has show details, at least one match, participant assignments, and accessible preview routes
- **THEN** the system marks the relevant readiness items as complete

#### Scenario: Show is missing setup data
- **WHEN** a selected show is missing required or expected setup data
- **THEN** the system identifies the missing readiness item without blocking existing admin operations unless existing validation already blocks them

#### Scenario: Location-gated show is incomplete
- **WHEN** a selected show requires location verification but lacks valid venue latitude, longitude, or radius
- **THEN** the system marks the location-gate readiness item as incomplete

#### Scenario: Match is incomplete
- **WHEN** a match is missing required sides or participant assignments for its match type
- **THEN** the system identifies the match as needing attention without changing the underlying match record or submitted pick payloads

#### Scenario: Match has presentational warnings
- **WHEN** a match has optional presentation gaps such as missing participant imagery, generic side labels, or incomplete championship display information
- **THEN** the system communicates those issues as warnings or informational readiness items rather than changing scoring, picks, or database validity

#### Scenario: Special match setup is incomplete
- **WHEN** a specialized match type requires extra configuration for fans to make meaningful picks
- **THEN** the system identifies the missing configuration in Card Builder while preserving the match type's existing validation and persistence behavior

### Requirement: Fan-Facing Preview And Share Actions
The system SHALL expose admin actions for opening existing fan-facing show, picks, scoreboard, and QR experiences for the selected show where those routes are available, including from the Card Builder workflow.

#### Scenario: Admin previews the show
- **WHEN** an authorized admin uses the preview action for a selected show
- **THEN** the system opens or links to the existing fan-facing show experience for that show and promotion

#### Scenario: Admin previews the card from Card Builder
- **WHEN** an authorized admin is reviewing or editing the match card
- **THEN** the system provides a prominent way to preview the existing fan-facing show experience for the selected show

#### Scenario: Admin opens picks or scoreboard
- **WHEN** an authorized admin uses picks or scoreboard actions for a selected show
- **THEN** the system opens or links to the existing picks or scoreboard experience without changing submitted picks or score calculations

### Requirement: Live Results Workflow
The system SHALL provide a results workflow optimized for entering and reviewing show results during or after a show, while Card Builder remains focused on configuring what fans can predict.

#### Scenario: Admin enters match results
- **WHEN** an authorized admin records a match winner, finish, match length, interference, or supported special-match result
- **THEN** the system persists the result using existing result fields and preserves existing score recalculation behavior

#### Scenario: Admin reviews result completion
- **WHEN** a selected show has multiple matches
- **THEN** the system shows which matches have results entered and which remain incomplete

#### Scenario: Admin builds a card before results are known
- **WHEN** an authorized admin uses Card Builder before or during show setup
- **THEN** winner and result-entry controls are not part of the default card-building surface

#### Scenario: Existing result controls remain available
- **WHEN** an authorized admin needs to enter or revise match results
- **THEN** the system keeps result entry available in the Results workflow without changing result storage, scoring recalculation, or scoreboard behavior

### Requirement: Advanced Feature Disclosure
The system SHALL keep advanced domains and specialized match configuration available without making them the default path for basic show or match setup.

#### Scenario: Admin needs advanced features
- **WHEN** an authorized admin opens the advanced area
- **THEN** the system provides access to existing advanced domains including rumble events, eliminators, Blind Gauntlet, show questions, confidence points, location gate settings, championship metadata, scoring maintenance, and data maintenance

#### Scenario: Admin follows the basic card workflow
- **WHEN** an authorized admin is creating a normal match card
- **THEN** advanced rumble, eliminator, Blind Gauntlet, scoring maintenance, and destructive data operations are visually secondary to basic show and match setup

#### Scenario: Admin configures a Blind Gauntlet match
- **WHEN** an authorized admin creates or edits a Blind Gauntlet match
- **THEN** the system exposes the required known-wrestler, candidate-pool, actual-entrant, survival, and final-entrant controls through a specialized match editing path

#### Scenario: Admin configures prediction-related match details
- **WHEN** an authorized admin edits prediction-related options such as match length, interference, finish, championship, or main-event details
- **THEN** the system keeps those controls available without requiring them in the default normal-match creation path

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

#### Scenario: Card Builder data is persisted
- **WHEN** an authorized admin creates, edits, reorders, or deletes card data
- **THEN** the system continues to use the existing show-level match, side, and participant data model unless a separate OpenSpec change explicitly changes the schema

#### Scenario: Existing result data exists on matches
- **WHEN** matches already have winner, finish, length, interference, or special-match result values
- **THEN** the system preserves those values and their existing Results, scoring, and scoreboard behavior while changing only where those controls are surfaced in the admin experience
