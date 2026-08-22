# picks Specification

This baseline documents observed existing BoutPick picks and prediction
behavior. It is not a proposal to change picks. When implementation details are
inconsistent or ambiguous, this spec preserves that inconsistency instead of
inventing intended behavior.

## Purpose

Picks cover how BoutPick players create, save, update, lock, retrieve, and
submit prediction payloads for shows.

Observed source-of-truth files include:
- `src/app/picks/page.tsx`
- `src/components/PicksSections.tsx`
- `src/lib/picksTypes.ts`
- `src/lib/scoring.ts`
- `src/app/scoreboard/page.tsx`
- `src/app/scoreboard/[userId]/page.tsx`
- `src/app/login/page.tsx`
- `src/app/admin/page.tsx`
- `src/lib/championData.ts`
- `supabase/schema.sql`

## Requirements

The requirements below intentionally separate canonical current application
behavior, legacy behavior, ambiguous behavior, potential defects, and future
cleanup candidates.

### Requirement: Current pick record model

Current application picks SHALL be represented as show-level rows in
`public.picks` keyed by authenticated user and show.

#### Scenario: A current pick row is saved

- **GIVEN** an authenticated player saves picks from the current picks flow
- **THEN** the application writes a `public.picks` row with `user_id`,
  `show_id`, and `payload`
- **AND** uses the `user_id,show_id` conflict target when upserting
- **AND** stores all prediction data in `payload` JSON.

#### Scenario: A current pick row is retrieved

- **GIVEN** an authenticated player opens the current picks flow for a show
- **THEN** the application reads that player's pick row by `show_id` and
  `user_id`
- **AND** hydrates missing current payload sections as empty objects.

### Requirement: Current payload shape

Current show-level pick payloads SHALL support the prediction sections observed
in the TypeScript application model.

#### Scenario: Supported payload sections

- **GIVEN** the current application reads or writes a pick payload
- **THEN** the payload MAY contain these top-level sections:
  - `rumbles`
  - `eliminators`
  - `question_picks`
  - `match_picks`
  - `match_confidence_picks`
  - `match_finish_picks`
  - `match_length_picks`
  - `match_interference_picks`
  - `blind_gauntlet_picks`

#### Scenario: Rumble payload shape

- **GIVEN** a player makes rumble predictions for an event
- **THEN** the payload stores them under `rumbles[event_id]`
- **AND** a rumble pick MAY include:
  - `entrants`
  - `final_four`
  - `winner`
  - `entry_1`
  - `entry_2`
  - `entry_30`
  - `iron_person`
  - `most_eliminations`.

#### Scenario: Eliminator payload shape

- **GIVEN** a player makes eliminator predictions
- **THEN** the payload stores them under `eliminators[eliminator_id]`
- **AND** an eliminator pick MAY include:
  - `entry_order`
  - `elimination_order`
  - `elimination_type`
  - `eliminated_by`
  - `winner_id`
  - `most_eliminations`.

#### Scenario: Show question payload shape

- **GIVEN** a player answers a show question
- **THEN** the payload stores the selected answer under
  `question_picks[show_question_id]`.

#### Scenario: Match payload shape

- **GIVEN** a player makes normal match predictions
- **THEN** the payload stores winner picks under `match_picks[match_id]`
- **AND** MAY store confidence ranks under
  `match_confidence_picks[match_id]`
- **AND** MAY store finish picks under `match_finish_picks[match_id]`
- **AND** MAY store match length picks under `match_length_picks[match_id]`
- **AND** MAY store interference picks under
  `match_interference_picks[match_id]`.

#### Scenario: Blind gauntlet payload shape

- **GIVEN** a player makes blind gauntlet predictions
- **THEN** the payload stores them under `blind_gauntlet_picks[match_id]`
- **AND** a blind gauntlet pick MAY include:
  - `survival`
  - `entrant_ids`
  - `final_entrant_id`.

### Requirement: Prediction association

Current prediction payload entries SHALL be associated with shows, events,
matches, questions, eliminators, and entrants by database ids.

#### Scenario: Show-level payload contains event-scoped rumble picks

- **GIVEN** a show has one or more rumble events
- **WHEN** a player makes rumble predictions
- **THEN** the pick row remains show-level
- **AND** individual rumble predictions are keyed by `events.id`.

#### Scenario: Match and question picks are keyed by current show records

- **GIVEN** a show has matches or show questions
- **WHEN** a player makes those predictions
- **THEN** match predictions are keyed by `matches.id`
- **AND** question predictions are keyed by `show_questions.id`.

### Requirement: Partial save behavior

Current picks MAY be saved before every possible prediction section is complete.

#### Scenario: A partial payload is saved

- **GIVEN** a player has an authenticated user id
- **AND** the selected show is not locked
- **WHEN** the player saves a payload that omits some supported prediction
  sections or leaves some prediction values empty
- **THEN** the current application MAY save the payload.

#### Scenario: Blind gauntlet current step must be complete before saving

- **GIVEN** the current pick step is a blind gauntlet match
- **WHEN** the player attempts to save
- **THEN** the current application requires a boolean survival pick
- **AND** at least one selected entrant id
- **AND** a final entrant id included in the selected entrant ids
- **AND** a match length pick.

### Requirement: Confidence-point mode

Shows that use confidence points SHALL add validation to selected normal match
winner picks.

#### Scenario: Confidence ranks are required for selected winners

- **GIVEN** a show uses confidence points
- **AND** a player has selected one or more non-blind-gauntlet match winners
- **WHEN** the player saves picks
- **THEN** each selected match winner must have a positive integer confidence
  rank.

#### Scenario: Confidence ranks must be unique and in range

- **GIVEN** a show uses confidence points
- **AND** a player saves selected normal match winners
- **THEN** each confidence rank must be unique among selected match winners
- **AND** no rank may exceed the number of available non-blind-gauntlet
  matches for the show.

### Requirement: Pick ownership and authentication

Current picks SHALL require a Supabase Auth user, including anonymous Supabase
Auth users.

#### Scenario: Anonymous player creates picks

- **GIVEN** a show does not require email registration
- **WHEN** a player signs up from the current login flow
- **THEN** the application MAY create an anonymous Supabase Auth user
- **AND** that user MAY create show-level picks using the anonymous user's
  `auth.uid()`.

#### Scenario: Email player creates picks

- **GIVEN** a show requires email registration
- **WHEN** a player signs up from the current login flow
- **THEN** the application uses Supabase email signup
- **AND** that authenticated user MAY create show-level picks.

#### Scenario: Owner writes are enforced by RLS

- **GIVEN** a pick insert or update is attempted through the Supabase client
- **THEN** RLS requires `auth.uid()` to equal `picks.user_id`.

### Requirement: Pick locking

Current show-level pick editing SHALL be controlled by show start time and show
lock configuration.

#### Scenario: A show locks at start

- **GIVEN** a show has `lock_picks_at_start` enabled
- **AND** the current time is at or after `shows.starts_at`
- **WHEN** a player attempts to save picks
- **THEN** the current application blocks the save as locked.

#### Scenario: A show does not lock at start

- **GIVEN** a show has `lock_picks_at_start` disabled
- **AND** the current time is at or after `shows.starts_at`
- **WHEN** a player opens the picks flow
- **THEN** live picks remain open
- **AND** completed matches are removed from the editable match flow.

#### Scenario: Completed normal matches are removed from live picks

- **GIVEN** live picks remain open after show start
- **WHEN** a normal match has a recorded winner side or winner entrant
- **THEN** that match is not included in available editable match steps.

#### Scenario: Completed blind gauntlet matches are removed from live picks

- **GIVEN** live picks remain open after show start
- **WHEN** a blind gauntlet match has a final entrant result or survival result
- **THEN** that match is not included in available editable match steps.

### Requirement: Submitted picks may be changed before locking

Current players MAY update previously submitted show-level picks while the show
is not locked.

#### Scenario: Player saves updated picks

- **GIVEN** a player already has a show-level pick row for a show
- **AND** the show is not locked
- **WHEN** the player saves a changed payload
- **THEN** the application updates the existing row for `user_id,show_id`.

### Requirement: Current pick consumers

Current show-level picks SHALL be consumed by scoring, scoreboard, and
championship flows.

#### Scenario: Live scoreboard consumes show-level picks

- **GIVEN** the live scoreboard loads a selected show
- **THEN** it reads picks by `show_id`
- **AND** calculates displayed scores from pick payloads and current result
  data.

#### Scenario: User scoreboard detail consumes show-level picks

- **GIVEN** a user scoreboard detail page loads for a selected show
- **THEN** it reads that user's pick payload by `show_id` and `user_id`
- **AND** displays the user's stored prediction sections.

#### Scenario: Championship data consumes show-level picks

- **GIVEN** championship flows resolve show participants or winners
- **THEN** they read picks by `show_id`
- **AND** use show-level payloads.

**Legacy behavior**

### Requirement: Legacy event-level picks remain separate

The database and legacy scripts support event-level picks, but this baseline
SHALL NOT define event-level picks as the canonical current application model.

#### Scenario: Legacy event-level pick row exists

- **GIVEN** a pick row has `event_id`
- **THEN** it uses the legacy event-level association model
- **AND** MAY use the `user_id,event_id` uniqueness constraint.

#### Scenario: Legacy seed scripts create event-level payloads

- **GIVEN** legacy seed behavior creates picks by `event_id`
- **THEN** those rows are legacy behavior
- **AND** they do not expand the canonical current show-level picks contract.

#### Scenario: Legacy database scoring reads event-level picks

- **GIVEN** legacy database score recalculation runs for an event
- **THEN** it reads picks by `event_id`
- **AND** this behavior remains separate from current show-level application
  picks unless future investigation proves otherwise.

**Ambiguous behavior**

### Requirement: Show-level and event-level coexistence remains unresolved

The baseline SHALL preserve the coexistence of `picks.show_id` and
`picks.event_id` without reconciling them.

#### Scenario: Pick row scope is not enforced by schema

- **GIVEN** the `picks` table has nullable `show_id` and nullable `event_id`
- **THEN** this baseline does not infer a database-enforced invariant that
  exactly one scope must be present
- **AND** does not infer how rows with both or neither scope should behave.

### Requirement: Authenticated pick visibility is broader than owner writes

The baseline SHALL preserve observed RLS behavior for pick visibility without
changing the authorization model.

#### Scenario: Authenticated users select picks

- **GIVEN** RLS policies are applied as written
- **THEN** pick inserts and updates are owner-scoped
- **AND** an authenticated select policy also allows authenticated users to
  select picks
- **AND** this baseline does not resolve whether that broad select behavior is
  intended product behavior.

### Requirement: Required prediction completeness is not globally defined

The baseline SHALL NOT invent a global completeness rule for submitted picks.

#### Scenario: Non-required sections are missing

- **GIVEN** a saved payload is missing some optional prediction sections or
  individual predictions
- **THEN** this baseline treats that as allowed current behavior where the save
  path allows it
- **AND** does not infer that every visible prediction must be completed before
  a pick row can exist.

**Potential implementation defects**

### Requirement: Confidence pruning mismatch is preserved

The baseline SHALL record the observed confidence-pick pruning mismatch as a
potential defect rather than changing the payload contract.

#### Scenario: Match-keyed payload sections are pruned

- **GIVEN** the picks flow normalizes payload data against the current match
  list
- **THEN** current match winner, finish, length, interference, and blind
  gauntlet sections are pruned for removed matches
- **BUT** `match_confidence_picks` may not be pruned by the same normalization
  path
- **AND** this is recorded as a potential implementation defect or
  inconsistency.

### Requirement: Future cleanup candidates remain unresolved

Future cleanup candidates SHALL be documented without resolving them as part of
the brownfield picks baseline.

#### Scenario: Future picks cleanup candidates are identified

- **GIVEN** the baseline identifies an inconsistency, ambiguity, or potential
  defect
- **THEN** it MAY record the item as a future OpenSpec cleanup or change
  candidate
- **AND** it MUST NOT resolve the item unless a future change explicitly does
  so.

The following are candidates for future investigation or explicit product
changes. They are not resolved by this baseline.

- Decide whether legacy event-level picks remain supported, should be migrated,
  or should be removed.
- Define a database invariant for `picks.show_id` versus `picks.event_id`.
- Decide whether authenticated users should be able to read all pick payloads.
- Define a database or application schema validation strategy for
  `picks.payload`.
- Investigate whether removed matches should also prune
  `match_confidence_picks`.
- Add automated tests or fixtures for the picks contract before making picks
  behavior changes.
