## Why

The current Card Builder still exposes too much of BoutPick's underlying match, side, participant, prediction, and result data model to promoters. This change makes building a wrestling card feel like assembling an ordered show lineup while preserving the existing brownfield data, picks, scoring, and authorization behavior.

## What Changes

- Replace the expanded match-record editing experience with a card-first overview of ordered matches for the selected show.
- Add a focused add/edit match workflow that prioritizes match type, participants, and common match details before advanced configuration.
- Show participant imagery from existing entrant data by default, while keeping side labels and custom side images available as optional advanced controls.
- Keep Blind Gauntlet and other specialized BoutPick match behavior available through match-type-specific advanced editing.
- Visually separate Card Builder from Results so result entry remains available in the Results workflow rather than being the default Card Builder surface.
- Add derived card readiness messaging for missing participants, incomplete special-match setup, missing imagery, and other setup concerns without storing new readiness state.
- Preserve existing show-level match, side, entrant, prediction, scoring, scoreboard, and RLS-backed admin behavior.

No breaking changes are intended.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `promoter-admin-console`: refine the Card Builder workflow, match overview, add/edit match flow, participant imagery, readiness guidance, and separation from results entry.

## Impact

- Affected code: primarily `src/app/admin/page.tsx`, with likely extraction into focused admin/card-builder components under `src/components/` if useful.
- Affected data: existing `matches`, `match_sides`, `match_entrants`, `entrants`, `gauntlet_candidate_entrants`, and result fields on `matches` continue to be used.
- APIs/server actions: no new API route or server action is expected for the first implementation; preserve existing client Supabase access under RLS.
- Authorization/RLS: admin writes must continue to rely on existing RLS policies; do not introduce service-key access for Card Builder.
- Promotion scope: Card Builder remains scoped to the selected promotion-scoped show.
- Predictions/scoring: submitted pick payloads and scoring rules are not changed. Moving result controls visually must preserve existing result persistence and recalculation behavior through the Results workflow.
- Database schema: no schema migration is expected. Any later prediction-default or drag/drop persistence change would require a separate explicit schema review.
