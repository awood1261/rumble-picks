## ADDED Requirements

### Requirement: Dedicated Multi-Step Create Show Flow
The admin console SHALL provide a mobile-first Create Show flow that separates initial event setup into focused steps and creates a promotion-scoped draft show only after the authorized user confirms the review step.

#### Scenario: Admin starts create flow
- **WHEN** an authorized admin or assigned promotion member starts creating a show from the Dashboard or Shows page
- **THEN** the system presents a dedicated Create Show flow rather than the existing all-in-one create modal
- **AND** the flow begins with show details for the currently selected promotion when one is available

#### Scenario: Admin enters show details
- **WHEN** an authorized user enters show title, promotion, date/time, venue name, venue address, poster URL, and short description
- **THEN** the system keeps show details grouped together in the first step
- **AND** uses the existing promotion-scoped show persistence behavior when the show is finally created

#### Scenario: Slug is generated automatically
- **WHEN** an authorized user creates a show without manually entering a share URL slug
- **THEN** the system generates a valid promotion-scoped show slug from the show title
- **AND** prevents creation when the generated or supplied slug would conflict with another show in the same promotion

#### Scenario: Fan experience is configured before picks settings
- **WHEN** an authorized user advances from show details to fan experience
- **THEN** the flow presents access-code configuration before picks-close configuration
- **AND** presents email registration, picks close timing, confidence points, and access-code options as fan-experience settings

#### Scenario: Location verification uses venue address
- **WHEN** an authorized user enables location verification and enters or changes a venue address
- **THEN** the system attempts to resolve venue latitude and longitude from the address
- **AND** allows the user to choose an allowed distance from the venue without manually entering latitude or longitude

#### Scenario: Review step summarizes creation settings
- **WHEN** an authorized user reaches the review step
- **THEN** the system summarizes show details, fan-experience settings, access-code state, and location-verification settings before creation
- **AND** allows the user to return to earlier steps to edit those settings before saving

#### Scenario: Show is created from review
- **WHEN** an authorized user confirms the review step with valid settings
- **THEN** the system creates a draft show for the selected promotion
- **AND** selects the newly created show for the admin console
- **AND** directs the user toward card building as the next logical workflow

### Requirement: Create Show Excludes Operational Lifecycle Controls
The Create Show flow SHALL focus on initial setup and SHALL NOT present operational show lifecycle controls as part of initial creation.

#### Scenario: Featured play routing is not configured during creation
- **WHEN** an authorized user creates a show
- **THEN** the flow does not present "Send /play to this show" or equivalent featured-play routing as a creation step
- **AND** the user can manage that behavior after the show exists through existing show-management operations

#### Scenario: Completed state is not configured during creation
- **WHEN** an authorized user creates a show
- **THEN** the flow does not present "Mark show as over" or equivalent completed-show lifecycle control as a creation step
- **AND** the user can manage show completion after the show exists through existing lifecycle or results operations

### Requirement: Promotion-Scoped Create Show Authorization
The Create Show flow SHALL preserve promotion-scoped authorization for both global admins and assigned promotion members.

#### Scenario: Assigned promotion member creates a show
- **WHEN** a promotion member creates a show
- **THEN** the available promotion choices are limited to promotions they can manage
- **AND** the created show is scoped to one of those promotions

#### Scenario: User lacks promotion access
- **WHEN** a user attempts to create a show for a promotion they cannot manage
- **THEN** the system blocks creation
- **AND** no show or access-code setting is saved for that promotion

### Requirement: Show Access Code Administration
The admin console SHALL allow authorized show managers to require an access code for a show without exposing a reusable plaintext code after it is saved.

#### Scenario: Admin enables access code during create flow
- **WHEN** an authorized user enables an access code and enters a valid code during Create Show
- **THEN** the show is created with access-code enforcement enabled
- **AND** the stored value is not recoverable as plaintext from the admin interface

#### Scenario: Admin reviews access code setting
- **WHEN** an authorized user reviews a show that has an access code configured
- **THEN** the system indicates that access-code protection is enabled
- **AND** does not display the saved plaintext access code

#### Scenario: Admin changes access code later
- **WHEN** an authorized show manager updates the show access code after creation
- **THEN** future fan access-code validation uses the updated code
- **AND** existing picks and scores remain unchanged
