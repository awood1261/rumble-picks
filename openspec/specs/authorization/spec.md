# authorization Specification

This baseline documents observed existing BoutPick authorization and
access-control behavior. It is not a proposal to change authentication,
authorization, RLS, or server-side privileged access. When implementation
details are inconsistent or ambiguous, this spec preserves that inconsistency
instead of inventing intended behavior.

## Purpose

Authorization covers how BoutPick identifies users, gates access in the UI,
enforces database permissions through Supabase RLS, uses global administrator
privileges, and performs server-side operations that bypass RLS.

Observed source-of-truth files include:
- `supabase/schema.sql`
- `supabase/champion-claims-schema.sql`
- `supabase/blind-gauntlet-match.sql`
- `src/lib/supabaseClient.ts`
- `src/lib/supabaseAdmin.ts`
- `src/app/login/page.tsx`
- `src/app/profile/page.tsx`
- `src/app/picks/page.tsx`
- `src/app/admin/page.tsx`
- `src/components/NavBar.tsx`
- `src/components/AdminConsoleLink.tsx`
- `src/components/ChampionClaimPage.tsx`
- `src/app/api/champion/*/route.ts`
- `src/lib/championData.ts`
- `scripts/*.mjs`

## Requirements

The requirements below intentionally separate current enforced behavior,
UI-only behavior, privileged/RLS-bypassing behavior, ambiguous behavior,
potential security concerns, legacy/operational behavior, and future cleanup
candidates.

### Requirement: Supabase Auth identity model

BoutPick users SHALL be represented by Supabase Auth users for current
application flows.

#### Scenario: Email user signs up

- **GIVEN** a show requires email registration
- **WHEN** a player signs up through the current login flow
- **THEN** the application creates or authenticates a Supabase Auth user using
  email and password.

#### Scenario: Anonymous player signs up

- **GIVEN** a show does not require email registration
- **WHEN** a player signs up through the current login flow
- **THEN** the application MAY create a Supabase anonymous Auth user
- **AND** that anonymous Auth user is treated as an authenticated user for RLS.

### Requirement: Profile identity rows

Each Supabase Auth user SHALL be associated with a row in `public.profiles`.

#### Scenario: Profile is created for a new auth user

- **GIVEN** a Supabase Auth user is inserted
- **THEN** the database trigger `public.handle_new_user()` creates a
  `public.profiles` row with the auth user id
- **AND** initializes profile display fields from auth metadata where present.

#### Scenario: Profile is updated by owner

- **GIVEN** a signed-in user updates their profile
- **THEN** RLS permits updating only the row where `profiles.id = auth.uid()`.

### Requirement: Global administrator model

Current administration SHALL be global and based on `profiles.is_admin`.

#### Scenario: Admin status is evaluated

- **GIVEN** a database policy calls `public.is_admin(auth.uid())`
- **THEN** admin status is true only when the matching `profiles` row has
  `is_admin = true`.

#### Scenario: Admin capability is not promotion-scoped

- **GIVEN** a user is an administrator
- **THEN** current RLS policies grant admin writes globally for admin-managed
  tables
- **AND** this baseline does not define promotion-specific administrator
  assignment.

### Requirement: RLS is the primary authorization boundary

Current browser-side Supabase operations SHALL rely on Supabase RLS as the
database authorization boundary.

#### Scenario: Browser client performs a database operation

- **GIVEN** application code uses the publishable Supabase browser client
- **WHEN** it reads or writes Supabase tables
- **THEN** permissions are enforced by the active Supabase Auth session and RLS
  policies.

#### Scenario: UI hides restricted operations

- **GIVEN** the UI hides an admin link, redirects a user, or conditionally
  renders admin controls
- **THEN** that UI behavior is not treated as the security boundary
- **AND** database access still depends on RLS unless a server-side privileged
  path is used.

### Requirement: Public-readable game data

Current game configuration and result data SHALL be broadly readable according
to observed RLS policies.

#### Scenario: Public users read game data

- **GIVEN** a public or anonymous visitor reads game data
- **THEN** RLS permits selecting promotions, shows, events, show questions,
  eliminators, eliminator entries, eliminator eliminations, entrants, matches,
  match sides, match entrants, gauntlet candidate entrants, gauntlet actual
  entrants, rumble entries, and scores.

### Requirement: Authenticated profile and pick reads

Current RLS SHALL permit authenticated users to select profiles and picks.

#### Scenario: Authenticated user reads profiles

- **GIVEN** a user has an authenticated Supabase session
- **THEN** RLS permits selecting `profiles` rows.

#### Scenario: Authenticated user reads picks

- **GIVEN** a user has an authenticated Supabase session
- **THEN** RLS permits selecting `picks` rows.

### Requirement: User-owned writes

Current user-owned writes SHALL be enforced by RLS owner checks.

#### Scenario: User writes own picks

- **GIVEN** a signed-in user inserts, updates, or deletes a pick row
- **THEN** RLS permits the operation only when `picks.user_id = auth.uid()`.

#### Scenario: User writes own profile

- **GIVEN** a signed-in user updates a profile row
- **THEN** RLS permits the operation only when `profiles.id = auth.uid()`.

### Requirement: Custom entrant submission

Authenticated non-admin users SHALL be able to submit pending custom entrants
under the current custom entrant RLS policy.

#### Scenario: Player inserts pending custom entrant

- **GIVEN** a signed-in player creates a custom entrant from the picks flow
- **THEN** RLS permits the insert only when:
  - `auth.uid()` is present
  - `is_custom = true`
  - `created_by = auth.uid()`
  - `event_id` is not null
  - `status = 'pending'`.

#### Scenario: Player sees own pending entrant

- **GIVEN** a player has created a pending custom entrant
- **THEN** the current picks flow includes approved entrants and that user's own
  pending entrants for the event.

#### Scenario: Admin approves or rejects custom entrant

- **GIVEN** an administrator approves or rejects a pending custom entrant
- **THEN** the operation uses normal admin table permissions through RLS.

### Requirement: Admin-managed data writes

Admin-managed game data SHALL require global admin authorization through RLS
when accessed with the browser Supabase client.

#### Scenario: Admin modifies game configuration or results

- **GIVEN** a signed-in administrator uses the current admin console
- **THEN** RLS permits modifying admin-managed tables through
  `public.is_admin(auth.uid())`.

#### Scenario: Non-admin attempts admin write

- **GIVEN** a signed-in non-admin attempts to modify admin-managed tables
  through the browser Supabase client
- **THEN** RLS denies the write unless another explicit non-admin policy
  applies.

### Requirement: Admin event logs

Event action logs SHALL be admin-only in current RLS behavior.

#### Scenario: Admin reads or writes event log

- **GIVEN** an administrator reads or writes `event_action_log`
- **THEN** RLS permits the operation through `public.is_admin(auth.uid())`.

#### Scenario: Non-admin reads event log

- **GIVEN** a non-admin attempts to select `event_action_log`
- **THEN** RLS denies the read.

**UI-only behavior**

### Requirement: Admin UI gates are not security boundaries

Admin links and admin page rendering checks SHALL be treated as UX behavior,
not as the canonical authorization boundary.

#### Scenario: Admin navigation link is shown

- **GIVEN** the navigation or admin link component reads `profiles.is_admin`
- **WHEN** it conditionally displays a link to `/admin`
- **THEN** this only changes visible navigation
- **AND** does not grant or deny database permissions.

#### Scenario: Admin page blocks non-admin rendering

- **GIVEN** `/admin` checks the current user's profile and displays an
  "Admin access only" state
- **THEN** this is a client-side UI guard
- **AND** admin data writes are still enforced by RLS.

**Privileged/RLS-bypassing behavior**

### Requirement: Server admin Supabase access bypasses RLS

Server-side helpers using `SUPABASE_SECRET_KEY` SHALL be treated as privileged
RLS-bypassing operations.

#### Scenario: Server admin client is used

- **GIVEN** code uses `src/lib/supabaseAdmin.ts`
- **THEN** it creates a Supabase client with `SUPABASE_SECRET_KEY`
- **AND** that client bypasses RLS.

#### Scenario: Champion/title helpers use admin access

- **GIVEN** champion or title data helpers execute
- **THEN** they MAY read promotions, shows, picks, profiles, champion card
  codes, and champion claims through the server admin client
- **AND** those reads bypass RLS.

#### Scenario: Champion claim is created

- **GIVEN** a champion claim API validates a promotion champion code
- **WHEN** the claim is created
- **THEN** the server inserts `champion_claims` using the server admin client
- **AND** requires a claimed username
- **AND** requires either a claimed user id or a claimed guest id.

### Requirement: Champion card code validation

Champion claim APIs SHALL validate submitted champion card codes against
promotion-scoped active code rows before returning code-protected data or
creating code-protected claims.

#### Scenario: Champion code is valid

- **GIVEN** a request supplies a promotion id and champion code
- **WHEN** the server validates the code
- **THEN** it checks for an active matching `champion_card_codes` row for that
  promotion.

#### Scenario: Champion code is invalid

- **GIVEN** no active matching champion code exists for the supplied promotion
- **THEN** code-protected champion API operations reject the request.

### Requirement: Request-supplied champion identity is current behavior

The baseline SHALL record that current champion APIs accept identity values
from request bodies in some privileged paths.

#### Scenario: Champion claim receives identity from request

- **GIVEN** `/api/champion/claim` creates a champion claim
- **THEN** the route accepts `claimedByUserId` and `claimedByGuestId` from the
  request body
- **AND** passes those values to the RLS-bypassing claim helper after champion
  code validation.

#### Scenario: Champion profile route receives user id from request

- **GIVEN** `/api/champion/profile` loads champion claims
- **THEN** the route accepts `userId` from the request body
- **AND** reads matching claims through the RLS-bypassing champion helper.

**Legacy and operational behavior**

### Requirement: Operational scripts use service access

Repository scripts that use `SUPABASE_SECRET_KEY` SHALL be treated as
operational privileged behavior, not as normal application authorization.

#### Scenario: Script runs with secret key

- **GIVEN** a script under `scripts/` uses `SUPABASE_SECRET_KEY`
- **THEN** the script uses service-level Supabase access
- **AND** may bypass normal RLS restrictions.

**Ambiguous behavior**

### Requirement: Champion claim table direct-client RLS is not fully defined

The baseline SHALL preserve ambiguity around direct-client RLS behavior for
champion claim tables.

#### Scenario: Champion claim schema sidecar is inspected

- **GIVEN** `supabase/champion-claims-schema.sql` defines champion card code
  and claim tables
- **AND** the file notes that RLS was enabled manually
- **THEN** this baseline does not infer complete direct-client RLS policy
  behavior for those tables from the repository SQL alone.

### Requirement: Promotion-scoped administration is not current enforced behavior

The baseline SHALL NOT describe desired promotion-scoped administration as
current behavior.

#### Scenario: Admin scope is evaluated

- **GIVEN** the current repository is inspected for promotion admin ownership or
  assignment
- **THEN** no current RLS policy or table establishes promotion-specific admin
  authorization
- **AND** current admin authorization remains global.

**Potential security concerns**

### Requirement: Broad authenticated profile and pick reads are preserved

The baseline SHALL record broad authenticated select access to profiles and
picks as current behavior and a potential future security review item.

#### Scenario: Authenticated read policy is broader than owner/admin

- **GIVEN** RLS has owner/admin select policies for profiles and picks
- **AND** also has authenticated select policies for profiles and picks
- **THEN** the effective current behavior permits authenticated users to select
  those tables
- **AND** this baseline does not resolve whether that breadth is intended.

### Requirement: Request-body identity trust is preserved

The baseline SHALL record request-body identity trust in RLS-bypassing champion
APIs as a potential security review item.

#### Scenario: Server route uses request-supplied user id

- **GIVEN** a server route uses `SUPABASE_SECRET_KEY`
- **AND** accepts a user id or guest id from the request body
- **THEN** this baseline records that behavior as potentially risky
- **AND** does not change or reinterpret it.

### Requirement: Future cleanup candidates remain unresolved

Future cleanup candidates SHALL be documented without resolving them as part of
the brownfield authorization baseline.

#### Scenario: Future authorization cleanup candidates are identified

- **GIVEN** the baseline identifies an inconsistency, ambiguity, or potential
  security concern
- **THEN** it MAY record the item as a future OpenSpec cleanup or change
  candidate
- **AND** it MUST NOT resolve the item unless a future change explicitly does
  so.

The following are candidates for future investigation or explicit product
changes. They are not resolved by this baseline.

- Define whether administration should become promotion-scoped.
- Decide whether authenticated users should be able to read all profiles and
  picks.
- Define repository-managed RLS policies for champion card code and champion
  claim tables.
- Decide whether champion APIs should verify Supabase Auth server-side instead
  of trusting request-supplied user ids.
- Decide whether champion guest identity should remain localStorage/request-body
  based or move to an authenticated identity model.
- Add automated authorization/RLS tests or fixtures before changing
  authorization behavior.
