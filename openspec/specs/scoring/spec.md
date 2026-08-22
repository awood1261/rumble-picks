# scoring Specification

This baseline documents observed existing BoutPick scoring behavior. It is not a
proposal to change scoring. When implementation details are inconsistent or
ambiguous, this spec preserves that inconsistency instead of inventing intended
behavior.

## Purpose

Scoring covers how BoutPick turns submitted prediction payloads and entered
results into points, standings, rank context, and champion selection.

Observed source-of-truth files include:
- `src/lib/scoring.ts`
- `src/lib/scoringRules.ts`
- `src/app/picks/page.tsx`
- `src/app/scoreboard/page.tsx`
- `src/app/scoreboard/[userId]/page.tsx`
- `src/app/admin/page.tsx`
- `src/lib/championData.ts`
- `supabase/schema.sql`

## Requirements

The requirements below intentionally separate canonical current application
behavior, legacy behavior, unspecified behavior, potential defects, and future
cleanup candidates.

### Requirement: Application scoring source

Current application scoring behavior SHALL use the TypeScript scoring rules in
`src/lib/scoringRules.ts` and the TypeScript scoring implementation in
`src/lib/scoring.ts` where that implementation clearly applies.

#### Scenario: Points are assigned from current application rules

- **GIVEN** application scoring is calculated
- **THEN** the following point values apply:
  - rumble entrants: `1`
  - final four: `6`
  - winner: `12`
  - entry #1: `6`
  - entry #2: `6`
  - entry #30: `5`
  - iron person: `6`
  - most eliminations: `6`
  - eliminator entry order: `2`
  - eliminator elimination order: `2`
  - eliminator elimination type: `1`
  - eliminator eliminated-by: `2`
  - eliminator most eliminations: `3`
  - eliminator winner: `10`
  - match winner: `5`, unless confidence scoring applies
  - match finish method: `2`
  - match finish winner: `2`
  - match finish loser: `2`
  - match length: `2`
  - match interference: `2`
  - blind gauntlet survival: `5`
  - blind gauntlet correct entrant: `2`
  - blind gauntlet incorrect entrant: `-2`
  - blind gauntlet final entrant: `2`
  - show question correct: `5`

### Requirement: Show-level prediction payloads

Current application scoring SHALL treat current prediction submissions as
show-level picks stored by `picks.show_id` with prediction data in
`picks.payload`.

#### Scenario: A user saves current picks

- **GIVEN** a user saves picks from the current picks flow
- **THEN** the application upserts a row using `user_id` and `show_id`
- **AND** uses the `user_id,show_id` conflict target
- **AND** stores the prediction payload as JSON.

#### Scenario: A show-level payload is scored

- **GIVEN** a show-level prediction payload is scored
- **THEN** the payload MAY contain rumble, eliminator, show-question, match
  winner, confidence, match-finish, match-length, match-interference, and blind
  gauntlet prediction sections.

### Requirement: Rumble scoring

Application rumble scoring SHALL award points according to entered
`rumble_entries` data and readiness checks.

#### Scenario: Entrant picks are scored

- **GIVEN** rumble entries exist for an event
- **WHEN** a user's selected entrant id is present among non-confirmed rumble
  entries
- **THEN** the entrant pick scores `1` point.

#### Scenario: Final four picks are scored

- **GIVEN** an event has at least four rumble entries
- **AND** four or fewer entrants remain without `eliminated_at`
- **WHEN** a user's final-four pick appears among the last four entries by
  elimination order
- **THEN** each correct final-four pick scores `6` points.

#### Scenario: Winner picks are scored

- **GIVEN** an event has at least thirty rumble entries
- **AND** exactly one entrant remains without `eliminated_at`
- **WHEN** a user's winner pick matches that remaining entrant
- **THEN** the winner pick scores `12` points.

#### Scenario: Entry-number picks are scored

- **GIVEN** a rumble entry exists for entry #1, #2, or #30
- **WHEN** a user's corresponding entry-number pick matches that entrant
- **THEN** the pick scores the configured points for that entry number.

#### Scenario: Iron person picks are scored

- **GIVEN** winner readiness is reached
- **AND** an iron person entrant is available from the event override or derived
  from the latest eliminated entrant
- **WHEN** a user's iron person pick matches that entrant
- **THEN** the pick scores `6` points.

#### Scenario: Most-eliminations picks are scored

- **GIVEN** winner readiness is reached
- **AND** one or more entrants are tied for the maximum `eliminations_count`
- **WHEN** a user's most-eliminations pick is one of those entrants
- **THEN** the pick scores `6` points.

### Requirement: Match scoring

Application match scoring SHALL score non-blind-gauntlet match winners,
finish details, match length, and match interference from match result fields.

#### Scenario: Match winner scoring without confidence points

- **GIVEN** a non-blind-gauntlet match has a `winner_side_id`
- **AND** the show does not use confidence points
- **WHEN** a user's `match_picks` side id matches `winner_side_id`
- **THEN** the match winner pick scores `5` points.

#### Scenario: Match winner scoring with confidence points

- **GIVEN** a non-blind-gauntlet match has a `winner_side_id`
- **AND** the show uses confidence points
- **WHEN** a user's `match_picks` side id matches `winner_side_id`
- **AND** the user's confidence value for the match is a positive integer
- **THEN** the match winner pick scores the confidence value.

#### Scenario: Match finish method scoring

- **GIVEN** a non-blind-gauntlet match has a `finish_method`
- **WHEN** a user's finish method pick matches `finish_method`
- **THEN** the finish method pick scores `2` points.

#### Scenario: Match finish winner and loser scoring

- **GIVEN** a non-blind-gauntlet match has finish method `pinfall` or
  `submission`
- **AND** the user's finish method pick matches
- **AND** the match has more than two entrants
- **WHEN** the user's finish winner or finish loser pick matches the entered
  result entrant
- **THEN** each matching finish entrant pick scores `2` points.

#### Scenario: Match length and interference scoring

- **GIVEN** a match has `match_length` or `match_interference` result data
- **WHEN** the user's corresponding pick matches the result
- **THEN** each matching pick scores `2` points.

### Requirement: Blind gauntlet scoring

Application scoring SHALL handle blind gauntlet matches separately from normal
match winner and finish-method scoring.

#### Scenario: Blind gauntlet survival scoring

- **GIVEN** a blind gauntlet match has boolean `gauntlet_survival_result`
- **WHEN** the user's survival pick matches that result
- **THEN** the survival pick scores `5` points.

#### Scenario: Blind gauntlet entrant scoring

- **GIVEN** a blind gauntlet match has actual entrant rows
- **WHEN** a user selected entrant is present in those actual entrant rows
- **THEN** that entrant pick scores `2` points.
- **WHEN** a user selected entrant is not present in those actual entrant rows
- **THEN** that entrant pick scores `-2` points.

#### Scenario: Blind gauntlet final entrant scoring

- **GIVEN** a blind gauntlet match has `gauntlet_final_entrant_id`
- **WHEN** the user's final entrant pick matches it
- **AND** the final entrant pick is included in the user's selected entrant ids
- **THEN** the final entrant pick scores `2` points.

### Requirement: Eliminator scoring

Application eliminator scoring SHALL score entry order, elimination details,
most eliminations, and winner when the relevant result data is ready.

#### Scenario: Eliminator entry order scoring

- **GIVEN** every eliminator entry has an `entry_order`
- **WHEN** a user's predicted entry order for an entrant matches the result
- **THEN** that entrant's entry-order prediction scores `2` points.

#### Scenario: Eliminator elimination scoring

- **GIVEN** the number of recorded eliminations equals `entries.length - 1`
- **WHEN** a user's elimination order, elimination type, or eliminated-by pick
  matches a recorded elimination
- **THEN** the matching elimination order scores `2` points
- **AND** the matching elimination type scores `1` point
- **AND** the matching eliminated-by pick scores `2` points.

#### Scenario: Eliminator most-eliminations scoring

- **GIVEN** eliminator eliminations are ready
- **AND** one or more entrants are tied for the most eliminations
- **WHEN** the user's most-eliminations pick is among those entrants
- **THEN** the pick scores `3` points.

#### Scenario: Eliminator winner scoring

- **GIVEN** an eliminator has `winner_entrant_id`
- **WHEN** the user's eliminator winner pick matches it
- **THEN** the pick scores `10` points.

### Requirement: Show question scoring

Application show question scoring SHALL award points only for questions with a
recorded correct answer.

#### Scenario: Correct show question scoring

- **GIVEN** a show question has `correct_answer`
- **WHEN** a user's answer pick matches `correct_answer`
- **THEN** the question scores `5` points.

### Requirement: Live scoreboard calculation

The live scoreboard SHALL calculate and display scores from current show-level
prediction and result data in the browser.

#### Scenario: Live scoreboard displays calculated standings

- **GIVEN** a selected show has show-level picks
- **WHEN** the live scoreboard loads or refreshes
- **THEN** it reads picks by `show_id`
- **AND** calculates displayed score rows from current picks, profiles, events,
  rumble entries, matches, match sides, match entrants, gauntlet actuals,
  eliminators, and eliminator eliminations.

#### Scenario: Live scoreboard persistence is not assumed

- **GIVEN** the live scoreboard calculates displayed scores
- **THEN** the current implementation does not necessarily persist those
  calculated live scoreboard scores to the `scores` table.
- **AND** this baseline MUST NOT infer that persistence is required.

### Requirement: Champion-selection scoring

The champion-selection flow SHALL use show-level application scoring to select a
completed show's winner.

#### Scenario: Champion winner is selected from show-level picks

- **GIVEN** a completed show is eligible for champion selection
- **WHEN** champion data is resolved for that show
- **THEN** the flow reads picks by `show_id`
- **AND** scores them with the TypeScript application scoring implementation
- **AND** selects the user with the highest score.

#### Scenario: Champion winner tie-break

- **GIVEN** two or more champion-eligible users have the same highest score
- **WHEN** champion winner selection compares those users
- **THEN** the user with the earlier `picks.updated_at` value wins the
  champion-selection tie-break.
- **AND** this tie-break applies only where confirmed by the champion-selection
  implementation.

**Legacy scoring behavior**

### Requirement: Legacy event-level database scoring is separate

The database scoring function in `supabase/schema.sql` SHALL be treated as
legacy event-level scoring unless current production usage proves otherwise.

#### Scenario: Legacy database scoring recalculates event rumble scores

- **GIVEN** `public.recalculate_scores_for_event(p_event_id)` runs
- **THEN** it reads picks by `event_id`
- **AND** scores only legacy rumble fields:
  - entrants
  - final four
  - winner
  - entry #1
  - entry #2
  - entry #30
  - most eliminations
- **AND** writes rows to `scores` keyed by `user_id,event_id`.

#### Scenario: Legacy database scoring is triggered by rumble entry changes

- **GIVEN** a `rumble_entries` row is inserted, updated, or deleted
- **THEN** the database trigger calls
  `public.recalculate_scores_for_event()` for that event.

#### Scenario: Legacy database scoring does not define current app scoring

- **GIVEN** database scoring differs from TypeScript application scoring
- **THEN** this baseline preserves the difference
- **AND** does not reconcile, remove, or promote the legacy behavior to
  canonical current application scoring.

**Unspecified behavior**

### Requirement: Live scoreboard equal-point ordering is unspecified

The baseline SHALL NOT define a deterministic tie-breaker for equal-point live
scoreboard rows.

#### Scenario: Live scoreboard users have equal points

- **GIVEN** two or more live scoreboard rows have equal points
- **WHEN** the scoreboard sorts rows
- **THEN** their relative order is currently unspecified by this baseline.

### Requirement: Admin recalculation canonical status is unresolved

Admin recalculation versus show-level picks SHALL be recorded as an unresolved
brownfield inconsistency.

#### Scenario: Admin recalculation reads event-level picks

- **GIVEN** admin recalculation is triggered from the current admin UI
- **THEN** the observed implementation reads picks by `event_id`
- **AND** upserts scores with `user_id,event_id`
- **BUT** this behavior is not defined as canonical current application scoring
  unless production usage proves it is required.

**Potential implementation defects**

### Requirement: Potential most-eliminations data mismatch is preserved

The baseline SHALL preserve the TypeScript application scoring rule for
most-eliminations scoring where clear, and SHALL record incomplete live
scoreboard data loading as a potential defect rather than changing the rule.

#### Scenario: Live scoreboard may omit eliminations count

- **GIVEN** canonical TypeScript scoring uses `eliminations_count` for
  most-eliminations scoring
- **AND** the live scoreboard rumble-entry query may not load
  `eliminations_count`
- **THEN** this is recorded as a candidate implementation defect or
  inconsistency
- **AND** the canonical scoring rule is not changed to match the potentially
  incomplete query.

### Requirement: Future cleanup candidates remain unresolved

Future cleanup candidates SHALL be documented without resolving them as part of
the brownfield scoring baseline.

#### Scenario: Future scoring cleanup candidates are identified

- **GIVEN** the baseline identifies an inconsistency, ambiguity, or potential
  defect
- **THEN** it MAY record the item as a future OpenSpec cleanup or change
  candidate
- **AND** it MUST NOT resolve the item unless a future change explicitly does so.

The following are candidates for future investigation or explicit product
changes. They are not resolved by this baseline.

- Investigate whether admin score recalculation should operate on show-level
  picks, event-level picks, both, or a different explicit model.
- Decide whether live scoreboard-calculated show-level scores should ever be
  persisted to `scores`.
- Investigate the live scoreboard `eliminations_count` query mismatch and its
  impact on most-eliminations display.
- Define a deterministic live scoreboard tie-breaker if product behavior needs
  one.
- Decide whether legacy database event-level scoring should remain, be migrated,
  or be removed through an explicit future change.
- Add automated tests or fixtures for the scoring contract before making
  scoring changes.
