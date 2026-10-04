## ADDED Requirements

### Requirement: State-Aware Admin Dashboard
The admin console SHALL present the Dashboard as a task-oriented surface that prioritizes the next logical show-management action for the authorized user's visible promotion-scoped shows.

#### Scenario: No actionable show exists
- **WHEN** an authorized admin opens the Dashboard and has no visible draft, current, live, or upcoming show
- **THEN** the Dashboard presents an intentional start state with a dominant create-show action
- **AND** does not present edit-show or enter-results actions as primary actions

#### Scenario: Draft or setup show exists
- **WHEN** an authorized admin opens the Dashboard and the most actionable visible show still needs setup
- **THEN** the Dashboard presents that show with a primary action for continuing setup
- **AND** keeps ordinary show editing available without making results entry the dominant action

#### Scenario: Upcoming ready show exists
- **WHEN** an authorized admin opens the Dashboard and the most actionable visible show is upcoming and ready or nearly ready for fans
- **THEN** the Dashboard presents that show with show timing, venue or location context where available, readiness context, and a primary action for reviewing or preparing the show

#### Scenario: Live show exists
- **WHEN** an authorized admin opens the Dashboard and the most actionable visible show appears to be live or in progress
- **THEN** the Dashboard makes entering results the dominant action
- **AND** visually identifies the show as live or in progress
- **AND** keeps setup or edit actions visually secondary

#### Scenario: Only completed shows exist
- **WHEN** an authorized admin opens the Dashboard and all visible shows are completed
- **THEN** the Dashboard makes creating a new show prominent
- **AND** keeps access to completed-show results or analytics secondary

#### Scenario: Dashboard preserves selected-show behavior
- **WHEN** an authorized admin uses a Dashboard action for a visible show
- **THEN** the downstream admin workflow operates on that show using the existing selected-show context

### Requirement: Admin Shows Page Event Management
The admin console SHALL present the Shows page as an event-management surface organized around visible promotion-scoped shows rather than as a repeated active-show selector.

#### Scenario: Admin views Shows page
- **WHEN** an authorized admin opens the Shows page
- **THEN** the page presents a prominent create-show action near the top of the view
- **AND** organizes visible shows into meaningful event-management groupings such as current/live, upcoming, draft/setup, and past shows

#### Scenario: Show card summarizes management context
- **WHEN** an authorized admin views a show in a Shows page grouping
- **THEN** the show card includes enough information to identify the show, its promotion or promotion context when needed, date or timing where available, venue or location where available, lifecycle/readiness context, and match count where available

#### Scenario: Show card presents state-appropriate action
- **WHEN** an authorized admin views a show card
- **THEN** the card presents a primary action appropriate to that show's derived management state
- **AND** draft/setup shows prioritize continuing setup
- **AND** upcoming ready shows prioritize editing or reviewing the show
- **AND** live shows prioritize entering results
- **AND** completed shows prioritize viewing results or analytics

#### Scenario: Admin switches show from show card
- **WHEN** an authorized admin chooses an action for a show card that opens another admin workflow
- **THEN** the system updates the selected-show context before or as part of opening that workflow
- **AND** the Card Builder, Results, Scoreboard, review, and edit flows operate on the chosen show

#### Scenario: Admin has multiple promotions
- **WHEN** an authorized admin can manage shows across multiple promotions
- **THEN** the Shows page preserves promotion scope and makes the promotion context of each show clear enough to avoid editing the wrong promotion's show

### Requirement: Admin Show Lifecycle Derivation Compatibility
The state-aware Dashboard and Shows page SHALL derive management states from existing show and setup data without requiring a new database lifecycle state machine.

#### Scenario: Existing show data drives state
- **WHEN** the admin console determines whether a show is draft/setup, upcoming, live, or completed
- **THEN** the determination uses existing show data such as start time, completed/over status, readiness inputs, and available card/result data
- **AND** does not require a new schema field to display the redesigned Dashboard or Shows page

#### Scenario: Existing show status is ambiguous
- **WHEN** existing stored show status is absent, generic, or not sufficient to determine the best admin action
- **THEN** the admin console uses other existing show and setup signals to choose the state-aware action
- **AND** does not block existing admin operations solely because the stored status is not authoritative

#### Scenario: Existing data contracts are preserved
- **WHEN** an authorized admin creates shows, edits show details, builds cards, enters results, opens previews, or views scoreboards after the redesign
- **THEN** those operations preserve existing Supabase/RLS-backed persistence behavior, submitted pick compatibility, scoring behavior, and fan-facing routes

### Requirement: Mobile-First Show Management Prioritization
The redesigned Dashboard and Shows page SHALL optimize primary show-management actions for mobile use while preserving responsive desktop behavior.

#### Scenario: Admin opens Dashboard on mobile
- **WHEN** an authorized admin opens the Dashboard on a mobile-sized viewport
- **THEN** the primary show-management action appears without requiring the admin to scan repeated selector controls or unrelated advanced operations first

#### Scenario: Admin needs results during live show on mobile
- **WHEN** an authorized admin is operating a live or in-progress show from a mobile-sized viewport
- **THEN** entering results is reachable from the Dashboard with minimal navigation

#### Scenario: Admin uses desktop viewport
- **WHEN** an authorized admin opens the redesigned Dashboard or Shows page on a desktop-sized viewport
- **THEN** the redesigned state-aware actions and event-management grouping remain available without regressing existing admin navigation behavior
