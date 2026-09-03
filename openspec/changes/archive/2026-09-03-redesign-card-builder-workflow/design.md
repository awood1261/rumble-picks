## Context

See `proposal.md` for motivation. This change builds on the archived promoter/admin console redesign and narrows in on the Card Builder workflow.

The current Card Builder is implemented primarily inside the client route component `src/app/admin/page.tsx`. It reads and writes Supabase directly under RLS. The relevant brownfield records are:

- `matches`: show-scoped match metadata, ordering, championship/main-event flags, winner/result fields, Blind Gauntlet result fields.
- `match_sides`: side labels and optional side image URLs.
- `match_entrants`: entrant-to-match side assignments.
- `entrants`: wrestler/entrant identity and imagery.
- `gauntlet_candidate_entrants` and `gauntlet_actual_entrants`: Blind Gauntlet candidate/result data.

Fan Picks and Scoreboard both read the same match, side, entrant, and result data. Result fields on `matches` directly affect app scoring. The redesign must therefore be a workflow and presentation change first, not a data-model change.

## Goals / Non-Goals

**Goals:**

- Make Card Builder read as an ordered wrestling card, with compact match summaries by default.
- Allow one focused match editor to open at a time.
- Make ordinary match creation require only the promoter-facing essentials first: match type and participants.
- Use existing entrant imagery by default so promoters do not need to paste image URLs for normal cards.
- Keep side labels, side images, championship metadata, main-event status, prediction-related configuration, and Blind Gauntlet behavior available through progressive disclosure.
- Move winner/result entry out of the default Card Builder surface and keep it in Results.
- Preserve existing Supabase client/RLS writes, submitted picks, scoring behavior, scoreboard behavior, and schema.

**Non-Goals:**

- No new database schema, migration, or RLS policy changes.
- No new API routes, server actions, Edge Functions, or service-role Card Builder access.
- No change to `picks.payload`, scoring rules, result semantics, or scoreboard calculation.
- No full admin architecture rewrite.
- No drag-and-drop dependency in the first implementation phase.
- No general prediction-template system in this change.

## Decisions

### Keep the current data model

Use the existing `matches`, `match_sides`, `match_entrants`, and gauntlet tables. This preserves picks and scoring compatibility and avoids a migration.

Alternative considered: introduce a new card-builder aggregate or draft-card model. Rejected for this change because the current fan and scoring flows already depend on the existing tables.

### Build a card overview plus focused editor

Render matches as compact ordered summaries and open one match's editing controls at a time. This reduces visual load without requiring route changes or a new persistence model.

Alternative considered: keep all matches expanded but restyle them. Rejected because it preserves the current record-administration feel.

### Separate card configuration from result entry

Card Builder should focus on what fans can predict: match type, sides, participants, championship/main-event metadata, and special match setup. Winner, finish, match length actuals, interference actuals, and gauntlet actual result entry should be surfaced through Results.

Alternative considered: leave result controls in Card Builder because the underlying fields live on `matches`. Rejected as a default UX because it mixes pre-show setup with post/during-show operations. The underlying fields and existing result handlers must still be reused.

### Use explicit save operations first

Retain explicit save behavior for match metadata and participant operations. Do not introduce autosave in this change. The current implementation performs multiple independent Supabase mutations and sometimes triggers score recalculation, so implicit saves would add race and partial-save risk.

Alternative considered: autosave or save-on-blur. Deferred until the mutation surface is smaller and test coverage exists.

### Start with accessible ordering controls

Preserve current `order_index` ordering and use existing move/reorder behavior. Do not add drag-and-drop as part of the first implementation unless the existing app already supports it.

Alternative considered: add a drag/drop library. Deferred because no drag/drop dependency exists and keyboard/mobile behavior would need extra design and test coverage.

### Derive readiness state

Compute readiness from existing show/match/side/entrant/gauntlet data in the client. Do not persist readiness status.

Alternative considered: store readiness on shows or matches. Rejected because it would duplicate state and require schema/backfill/RLS work.

### Reuse fan-facing routes for preview

Fan Preview should link to the existing show route for the selected promotion-scoped show rather than duplicating the fan UI in admin.

Alternative considered: build a separate embedded admin preview. Deferred because duplicate rendering risks drifting from what fans actually see.

## Risks / Trade-offs

- Card Builder and Results still share the `matches` table -> Keep handlers behavior-preserving and manually verify result entry after moving controls.
- Existing submitted picks may reference match IDs and side IDs -> Do not recreate matches/sides during visual edits; update existing rows in place.
- Moving result controls could hide a workflow admins currently use -> Keep Results prominent and verify winner, finish, length, interference, and special-match result entry there.
- Side image URLs are still supported -> Keep them as optional advanced overrides while using entrant images by default.
- No drag/drop initially may feel less polished -> Use clear reorder controls first; define drag/drop as a future enhancement if needed.
- Large `src/app/admin/page.tsx` contains substantial domain logic -> Extract small presentational components only where it reduces complexity without changing data flow.
- No automated application test suite exists -> Rely on `npm run build`, documented lint state, and targeted browser verification.

## Migration Plan

1. Implement the Card Builder redesign behind the existing `/admin` Card Builder view.
2. Reuse existing Supabase mutation handlers wherever possible.
3. Keep the existing Results workflow fully capable of result entry before visually removing result controls from Card Builder.
4. Verify existing shows with matches, sides, participants, results, and submitted picks continue to load.
5. If rollback is needed, revert the UI/component changes without database rollback because no schema changes are planned.

## Open Questions

- Whether a later change should add drag-and-drop reordering with a dedicated accessibility plan.
- Whether a later change should introduce show or promotion-level prediction presets.
- Whether a later change should add dedicated component or integration tests for admin workflows.
