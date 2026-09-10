## ADDED Requirements

### Requirement: Admin Roster Manager
The admin console SHALL provide an admin-only roster manager for creating, finding, and editing wrestler/entrant records used by BoutPick show setup.

#### Scenario: Admin views the roster manager
- **WHEN** an authorized admin opens the roster manager
- **THEN** the system shows existing wrestler/entrant records with enough information to identify their name, promotion, division, roster year, active status, and photo availability

#### Scenario: Admin searches and filters wrestlers
- **WHEN** an authorized admin searches or filters the roster by name, promotion, division, roster year, or active status
- **THEN** the system narrows the visible roster records without changing underlying entrant data

#### Scenario: Admin creates a wrestler
- **WHEN** an authorized admin provides a wrestler name, promotion, division, roster year, active status, and optional wrestler photo
- **THEN** the system creates an entrant record using the existing roster fields and makes that entrant available to existing card-building and prediction setup flows

#### Scenario: Admin edits a wrestler
- **WHEN** an authorized admin edits a wrestler's name, promotion, division, roster year, active status, or photo
- **THEN** the system updates the existing entrant record so current match/card references continue to point to the same entrant

#### Scenario: Admin marks a wrestler inactive
- **WHEN** an authorized admin wants to remove a wrestler from ordinary roster selection
- **THEN** the system allows the wrestler to be marked inactive without hard-deleting the entrant record

### Requirement: Admin Wrestler Photo Upload
The admin console SHALL allow authorized admins to upload or replace wrestler photos and associate the resulting public image URL with the wrestler's entrant record.

#### Scenario: Admin uploads a photo while creating a wrestler
- **WHEN** an authorized admin selects a valid wrestler photo file while creating a wrestler
- **THEN** the system uploads the photo to the configured Supabase Storage location and saves the public image URL on the created entrant record

#### Scenario: Admin replaces an existing wrestler photo
- **WHEN** an authorized admin uploads a replacement photo for an existing wrestler
- **THEN** the system stores the new photo and updates the entrant record to use the new public image URL

#### Scenario: Photo upload fails
- **WHEN** an authorized admin attempts to upload a wrestler photo and Storage rejects or fails the upload
- **THEN** the system reports the failure without silently creating or updating the entrant with an unusable image URL

#### Scenario: Admin creates a wrestler without a photo
- **WHEN** an authorized admin creates a wrestler without uploading a photo
- **THEN** the system allows the wrestler record to be saved without an image URL unless existing validation blocks it

### Requirement: Roster Manager Authorization And Compatibility
The roster manager SHALL preserve existing authorization, entrant references, picks, scoring, and public display contracts.

#### Scenario: Non-admin attempts roster management
- **WHEN** a user without admin authorization attempts to create, edit, upload photos for, or deactivate roster records
- **THEN** existing RLS-backed authorization prevents the unauthorized operation

#### Scenario: Existing matches reference a wrestler
- **WHEN** an authorized admin edits a wrestler already used by matches, rumble entries, eliminators, or gauntlet configuration
- **THEN** those records continue referencing the same entrant ID and retain existing picks, scoring, and scoreboard behavior

#### Scenario: Roster manager is introduced with existing data
- **WHEN** the roster manager is deployed into a database that already contains entrant records
- **THEN** existing entrants remain valid and visible according to current public-read/admin-write behavior

#### Scenario: Admin needs to delete a wrestler record
- **WHEN** an authorized admin wants to remove a global roster wrestler
- **THEN** the first version does not provide hard deletion as the ordinary removal action
