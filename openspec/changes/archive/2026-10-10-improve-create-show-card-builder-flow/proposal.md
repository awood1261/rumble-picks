## Why

The admin create-show flow now sends promoters toward Card Builder, but the next step still lacks explicit card-planning intent and the broader admin console can lose clear promotion/show context as users move between tools. Current readiness percentages can also imply a show is complete when BoutPick only knows that the currently entered data is valid.

## What Changes

- Add an optional post-creation card setup prompt after a draft show is created.
- Let promoters set a flexible planned match count after creation without adding match count to the primary Create Show form.
- Store planned match count as promoter intent on the show rather than generating real placeholder match records.
- Update Card Builder to show persistent promotion and current-show context above the selected tool.
- Replace percentage-based show readiness in Card Builder with concrete card configuration status, such as `0 of 6 matches configured`, `All added matches are configured`, or `2 matches need attention`.
- Render virtual planned match slots from planned match count while ensuring unconfigured slots do not appear in fan-facing cards, picks, results, scoreboards, scoring, or submitted pick payloads.
- Support both paths after show creation: setting up a planned card or adding matches manually over time.
- Preserve existing match creation, match ordering, participant assignment, results, scoring, and public read behavior for real configured match records.
- Move admin selection toward durable Promotion -> Current Show -> Tool context so refreshing or deep-linking does not unexpectedly lose the selected promotion/show.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `promoter-admin-console`: Adds optional post-create card setup, planned match count, persistent promotion/show context, virtual planned slots, and Card Builder configuration status behavior.
- `picks`: Preserves picks behavior by ensuring virtual planned match slots do not create prediction steps or affect existing pick payloads.
- `scoring`: Preserves scoring behavior by ensuring virtual planned match slots are excluded from scoring, results completeness, and scoreboard calculations.

## Impact

- Affected code:
  - `src/app/admin/page.tsx`
  - `src/app/picks/page.tsx`
  - `src/app/scoreboard/page.tsx`
  - `src/app/shows/[promotionId]/[showId]/page.tsx`
  - `src/lib/picksTypes.ts`
  - `src/lib/scoring.ts`
- Database/schema:
  - Adds a documented SQL sidecar for nullable `shows.planned_match_count`.
  - No required backfill for existing shows.
  - Existing shows with no planned count must continue to work.
- RLS/authorization:
  - Planned match count updates rely on existing promotion-scoped show update authorization.
  - Promotion/show context must never allow a show from one promotion to remain selected while another promotion is active.
- Predictions and existing submitted picks:
  - Real matches remain the only records that generate fan prediction UI.
  - Virtual planned slots must not change existing submitted pick payloads.
- Scoring and scoreboards:
  - Scoring continues to operate only on real match, event, eliminator, question, and result records.
  - Planned count is UI/planning metadata, not scoring input.
- Dependencies:
  - No new third-party dependency is expected.
- Non-goals:
  - Do not introduce a separate match-slot table unless implementation discovers that show-level planned count is insufficient.
  - Do not normalize legacy event-level picks or scoring.
  - Do not make planned match count an enforced show limit.
