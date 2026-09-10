## ADDED Requirements

### Requirement: Non-persistent show review flow
The picks experience SHALL support a review mode that lets reviewers step through configured prediction surfaces without submitting picks.

#### Scenario: Reviewer opens show review flow
- **WHEN** a reviewer opens the review flow with a valid review context
- **THEN** the system loads the selected show's configured events, eliminators, questions, and matches for review
- **AND** does not require the reviewer to have a player pick row.

#### Scenario: Reviewer advances through configured items
- **WHEN** a reviewer advances through the review flow
- **THEN** the reviewer can move through configured show items without selecting winners or answers.

#### Scenario: Reviewer interacts with choices
- **WHEN** a reviewer selects choices in review mode
- **THEN** those choices are temporary to the review session
- **AND** are not saved as submitted picks.

#### Scenario: Review mode reaches completion
- **WHEN** a reviewer reaches the end of the review flow
- **THEN** the system shows a review-complete state that does not represent submitted picks or a scored entry.

### Requirement: Review flow persistence isolation
The review flow SHALL remain isolated from current show-level pick persistence, drafts, scoring, and scoreboards.

#### Scenario: Review mode attempts to continue
- **WHEN** a reviewer clicks next or finish in review mode
- **THEN** the system does not insert, update, or upsert any `picks` row.

#### Scenario: Existing submitted picks are present
- **WHEN** a review flow is opened for a show with existing submitted picks
- **THEN** the review flow does not alter any existing `picks.payload` value or pick ownership behavior.

#### Scenario: Local drafts are used by players
- **WHEN** a reviewer uses review mode
- **THEN** the system does not write normal player draft or last-step local storage keys for the show.

#### Scenario: Scoreboards consume picks
- **WHEN** scoreboards or scoring load data after a review session
- **THEN** review-mode interactions do not appear as picks, points, rankings, score records, or championship participants.

### Requirement: Review flow normal behavior preservation
The review flow SHALL preserve ordinary picks behavior outside a valid review context.

#### Scenario: Player opens normal picks
- **WHEN** a player opens the ordinary picks flow for the same show
- **THEN** existing authentication, location verification, locking, validation, saving, draft, scoring, and scoreboard behavior remains unchanged.

#### Scenario: Invalid review context opens picks
- **WHEN** a request enters the picks flow with an invalid review context
- **THEN** the system does not use review mode to bypass ordinary picks requirements.
