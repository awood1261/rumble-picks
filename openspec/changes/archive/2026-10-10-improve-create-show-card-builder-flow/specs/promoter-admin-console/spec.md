## ADDED Requirements

### Requirement: Post-Creation Card Setup Prompt
The admin console SHALL keep initial show creation focused on essential show details and SHALL offer planned card setup only after a draft show has been successfully created.

#### Scenario: Admin creates show then sees card setup prompt
- **WHEN** an authorized admin or assigned promotion member creates a draft show
- **THEN** the system confirms that the show was created
- **AND** presents an optional "Set up your card?" step before entering Card Builder
- **AND** shows the newly created show's name, promotion, date/time, and image when available

#### Scenario: Admin sets planned match count
- **WHEN** an authorized admin chooses to set up planned matches from the post-creation prompt
- **THEN** the system allows the admin to choose a planned match count with a compact count control
- **AND** stores the selected count as flexible show planning intent
- **AND** routes the admin to Card Builder for the newly created show

#### Scenario: Admin skips planned setup
- **WHEN** an authorized admin chooses "I'll add matches as I go"
- **THEN** the system leaves the show without a planned match count
- **AND** routes the admin to Card Builder for the newly created show
- **AND** does not require the admin to know the final card size

#### Scenario: Main create form remains lightweight
- **WHEN** an authorized admin opens the primary Create Show form
- **THEN** the form focuses on show details, fan experience, location verification, and review settings
- **AND** does not require or display planned match count as an initial show detail

### Requirement: Planned Match Count Is Flexible Show Intent
The admin console SHALL represent planned match count as editable promoter intent rather than an enforced show limit.

#### Scenario: Planned count is stored without creating placeholder matches
- **WHEN** an authorized admin saves a planned match count for a show
- **THEN** the system stores the count on the show
- **AND** does not create unconfigured `matches`, `match_sides`, `match_entrants`, results, picks, or scores records solely because a planned count exists

#### Scenario: Admin adds more matches than originally planned
- **WHEN** a show has more real match records than the planned match count
- **THEN** the admin console continues to display and manage all real matches
- **AND** does not block card building, results entry, previews, picks, scoring, or scoreboards because the planned count was exceeded

#### Scenario: Admin changes planned count
- **WHEN** an authorized admin changes a show's planned match count
- **THEN** the system updates the planning target
- **AND** preserves existing real matches, participant assignments, results, submitted picks, and scores

#### Scenario: Existing show has no planned count
- **WHEN** an authorized admin opens Card Builder for a show without a planned match count
- **THEN** the system supports the show without requiring a migration or inferred planned total
- **AND** does not invent a denominator from current match count

### Requirement: Card Builder Shows Concrete Configuration Progress
The admin console SHALL replace misleading show-readiness percentage messaging in Card Builder with concrete card configuration status.

#### Scenario: Planned count exists
- **WHEN** an authorized admin opens Card Builder for a show with a planned match count
- **THEN** the system shows configured match progress using the planned count as the denominator
- **AND** uses language such as "0 of 6 matches configured"
- **AND** does not claim the entire show is ready solely because entered records are valid

#### Scenario: No planned count exists
- **WHEN** an authorized admin opens Card Builder for a show without a planned match count
- **THEN** the system communicates concrete status for added matches
- **AND** uses language such as "No matches added yet", "All added matches are configured", or "2 matches need attention"
- **AND** does not fabricate a completion percentage or planned denominator

#### Scenario: Match has setup issues
- **WHEN** a real match is missing required configuration for fan picks
- **THEN** Card Builder identifies that match as needing attention
- **AND** keeps editing available without changing scoring, picks, or database validity unless existing validation already requires it

#### Scenario: Match is configured
- **WHEN** a real match has the configuration needed for fan picks for its match type
- **THEN** Card Builder identifies that match as configured or ready for preview
- **AND** does not imply that the full card is complete unless planned progress supports that claim

### Requirement: Virtual Planned Match Slots
The admin console SHALL render unconfigured planned match slots as virtual admin-only UI rows until the admin chooses to create or configure a real match.

#### Scenario: Planned slots render after planned setup
- **WHEN** a show has a planned match count greater than its configured real match count
- **THEN** Card Builder renders virtual slots for the remaining planned positions
- **AND** labels them as not configured
- **AND** shows their intended order relative to existing real matches

#### Scenario: Admin opens a virtual slot
- **WHEN** an authorized admin selects a virtual planned slot
- **THEN** the system opens the existing match creation or editing workflow for that slot position
- **AND** creates real match data only when the admin saves match configuration

#### Scenario: Virtual slots remain admin-only
- **WHEN** virtual planned slots exist for a show
- **THEN** they appear only in admin planning surfaces
- **AND** they do not appear in fan-facing show pages, picks, results, scoreboards, scoring, or submitted pick payloads

### Requirement: Persistent Promotion Show Tool Context
The admin console SHALL keep promotion and current-show context visible and valid while the admin moves between show-specific tools.

#### Scenario: Admin opens show-specific tool
- **WHEN** an authorized admin opens Card Builder, Results, Scoreboard, or another show-specific admin tool
- **THEN** the system shows the active promotion, current show, show date/time, and relevant show status near the top of the tool
- **AND** the selected tool remains visually identifiable

#### Scenario: Admin refreshes or deep-links
- **WHEN** an authorized admin refreshes or opens an admin link containing promotion, show, and tool context
- **THEN** the admin console restores that context where authorization allows
- **AND** does not unexpectedly fall back to another promotion or show

#### Scenario: Promotion switch resets invalid show
- **WHEN** an authorized admin switches the active promotion
- **THEN** the current show selection is cleared or resolved to a show in the new promotion
- **AND** a show from the previous promotion never remains active under the new promotion context

#### Scenario: One-promotion user views context
- **WHEN** an assigned promotion member can manage only one promotion
- **THEN** the admin console displays that promotion as context
- **AND** does not unnecessarily present it as a switchable selector

#### Scenario: Multi-promotion user switches context
- **WHEN** an authorized admin can manage multiple promotions
- **THEN** the promotion context allows switching between manageable promotions
- **AND** makes the active promotion clear enough to avoid editing the wrong promotion's show
