## ADDED Requirements

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
