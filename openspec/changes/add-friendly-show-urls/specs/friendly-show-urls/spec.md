## Purpose

Defines friendly promotion and show URL behavior for public BoutPick show pages while preserving existing UUID-based links and internal ID-based data contracts.

## ADDED Requirements

### Requirement: Friendly Show URL Resolution
The system SHALL support public show URLs in the form `/shows/<promotion-slug>/<show-slug>` for promotion-scoped shows.

#### Scenario: Fan opens a friendly show URL
- **WHEN** a fan opens a URL containing a valid promotion slug and a valid show slug for that promotion
- **THEN** the system loads the same show page that would load for the corresponding promotion UUID and show UUID

#### Scenario: Friendly URL uses the wrong promotion
- **WHEN** a fan opens a URL with a valid show slug that does not belong to the requested promotion slug
- **THEN** the system does not load a show from another promotion

#### Scenario: Friendly URL cannot be resolved
- **WHEN** a fan opens a friendly show URL whose promotion or show identifier cannot be resolved
- **THEN** the system shows the existing missing or unavailable show behavior

### Requirement: UUID URL Compatibility
The system SHALL continue to support existing UUID-based promotion and show URLs.

#### Scenario: Fan opens an existing UUID show URL
- **WHEN** a fan opens `/shows/<promotion-id>/<show-id>` using existing UUID identifiers
- **THEN** the system loads the same show page after the friendly URL change

#### Scenario: Existing QR or shared link uses UUIDs
- **WHEN** an existing QR code, admin link, browser bookmark, or shared link points to a UUID-based show URL
- **THEN** the link remains valid and does not require data migration in picks, scores, or championship records

#### Scenario: UUID URL resolves to a show with slugs
- **WHEN** a UUID-based URL resolves to a show that has friendly slugs
- **THEN** the system MAY redirect to the friendly canonical URL or load in place, but it MUST preserve the same show behavior

### Requirement: Canonical Generated Links
The system SHALL prefer friendly show URLs when generating fan-facing show links and slugs are available.

#### Scenario: Show list renders show links
- **WHEN** the system renders a public show list or promotion show list for shows with slugs
- **THEN** generated show links use promotion and show slugs instead of UUIDs

#### Scenario: Admin previews a show
- **WHEN** an authorized admin opens or shares a selected show's fan-facing preview link and slugs are available
- **THEN** the generated show URL uses the friendly promotion/show slug path

#### Scenario: Play redirect selects a show
- **WHEN** the Play entry point redirects a fan to a selected or featured show with slugs
- **THEN** the redirect target uses the friendly promotion/show slug path

#### Scenario: Slugs are unavailable
- **WHEN** a show or promotion does not yet have the slug data needed for a friendly URL
- **THEN** generated links fall back to the existing UUID-based URL

### Requirement: Stable Internal Identity
The system SHALL resolve friendly URL identifiers to internal promotion and show UUIDs before invoking existing show-dependent behavior.

#### Scenario: Fan makes picks from a friendly show URL
- **WHEN** a fan navigates from a friendly show URL into the picks flow
- **THEN** submitted picks continue to use the internal `show_id` and existing show-level pick contract

#### Scenario: Fan opens scoreboard or championship actions from a friendly show URL
- **WHEN** a fan uses scoreboard, championship, location-gate, or related show actions from a friendly URL
- **THEN** those flows receive the resolved internal promotion and show IDs required by their existing contracts

#### Scenario: Existing submitted picks exist
- **WHEN** a show already has submitted picks before friendly URLs are introduced
- **THEN** the friendly URL change does not alter pick ownership, `picks.payload`, score calculation, scoreboard display, or championship winner calculation

### Requirement: Slug Uniqueness And Normalization
The system SHALL maintain stable, URL-safe slugs for promotions and shows.

#### Scenario: Promotion slug is generated
- **WHEN** a promotion slug is generated from a promotion name
- **THEN** the slug is normalized into a lowercase URL-safe identifier

#### Scenario: Show slug is generated
- **WHEN** a show slug is generated from a show name
- **THEN** the slug is normalized into a lowercase URL-safe identifier

#### Scenario: Duplicate promotion slug exists
- **WHEN** a promotion slug conflicts with another promotion
- **THEN** the system rejects the duplicate or generates a unique slug before saving

#### Scenario: Duplicate show slug exists within a promotion
- **WHEN** a show slug conflicts with another show in the same promotion
- **THEN** the system rejects the duplicate or generates a unique slug before saving

#### Scenario: Same show slug exists under different promotions
- **WHEN** two different promotions have shows with the same slug
- **THEN** both shows are allowed because show slugs are scoped to their promotion

### Requirement: Admin Slug Management
The system SHALL give authorized admins enough visibility or control to understand the friendly URL for a show.

#### Scenario: Admin creates a promotion or show
- **WHEN** an authorized admin creates a promotion or show with a name
- **THEN** the system provides a slug suitable for friendly URL generation

#### Scenario: Admin edits a slug
- **WHEN** authorized admin slug editing is supported
- **THEN** the system validates the slug format and uniqueness before saving

#### Scenario: Non-admin attempts to change slugs
- **WHEN** a non-admin user attempts to create or modify promotion or show slug data
- **THEN** existing RLS-backed authorization prevents the unauthorized write

### Requirement: Existing Route Behavior Preservation
The system SHALL preserve brownfield show-page behavior outside the URL identifier format.

#### Scenario: Show page loads through a friendly URL
- **WHEN** a show page is loaded through a friendly URL
- **THEN** existing show splash, picks lock, location gate, saved-picks detection, analytics properties, title links, and fan-facing navigation behavior remain equivalent to the UUID URL

#### Scenario: Metadata is generated for a friendly URL
- **WHEN** metadata is generated for a friendly show URL
- **THEN** the page title, description, social image, and canonical URL describe the resolved show and promotion

#### Scenario: Database migration is applied
- **WHEN** existing promotions and shows are migrated to support friendly URLs
- **THEN** existing records receive unique slugs without changing their IDs, promotion relationships, picks, scores, events, matches, or championship records
