## 1. Schema And Types

- [x] 1.1 Add a documented SQL sidecar for nullable `shows.planned_match_count` with a bounded check constraint, and verify the SQL is idempotent by inspection.
- [x] 1.2 Confirm existing show update RLS allows only global admins or assigned promotion members to update `planned_match_count`, and document any required RLS adjustment in the SQL sidecar.
- [x] 1.3 Update handwritten show row types and admin/picks/scoring select lists only where `planned_match_count` is needed, and verify TypeScript can reference the field without `any` casts.

## 2. Admin Context Architecture

- [x] 2.1 Add query-param backed admin context for active promotion, active show, and active tool, and verify refreshing `/admin` with those params restores the same authorized context.
- [x] 2.2 Enforce promotion/show consistency when resolving context, and verify switching promotions clears or resolves the current show to that promotion only.
- [x] 2.3 Preserve existing local admin view behavior while syncing URL context, and verify bottom navigation still switches Dashboard, Shows, Card, Results, Scoreboard, and More.
- [x] 2.4 Render compact persistent Promotion -> Current Show -> Tool context on show-specific admin tools, and verify it appears on mobile without pushing primary Card Builder content too far below the fold.

## 3. Post-Creation Card Setup

- [x] 3.1 Change successful Create Show handling to show a post-creation confirmation prompt instead of immediately entering Card Builder, and verify the created show remains selected.
- [x] 3.2 Add a compact planned match count stepper with primary `Set Up N Matches` and secondary `I'll add matches as I go` actions, and verify the primary Create Show form does not ask for match count.
- [x] 3.3 Save selected planned match count to `shows.planned_match_count` under existing scoped show update authorization, and verify the saved value appears after refresh.
- [x] 3.4 Support skipping planned setup with `planned_match_count = null`, and verify the user still lands in Card Builder for the new show.

## 4. Card Builder Planned Slots

- [x] 4.1 Add Card Builder derivation for virtual planned slots from `planned_match_count` and real ordered matches, and verify no virtual slot is stored as a `matches` row.
- [x] 4.2 Render virtual slots as admin-only `Not configured` rows with intended order, and verify real matches remain editable in their existing order.
- [x] 4.3 Open the existing match creation/edit workflow from a virtual slot with the intended order prefilled where practical, and verify saving creates a normal real match and sides.
- [x] 4.4 Allow real match count to exceed planned count without blocking editing, results, previews, picks, scoreboards, or scoring, and verify all real matches remain visible in Card Builder.
- [x] 4.5 Add a way to adjust planned match count after creation, and verify changing it preserves existing matches, participants, results, picks, and scores.

## 5. Configuration Status

- [x] 5.1 Replace Card Builder show-readiness percentage with concrete card progress when planned count exists, and verify copy such as `0 of 6 matches configured` is shown.
- [x] 5.2 Add no-planned-count status copy, and verify states such as no matches, all added matches configured, and matches needing attention.
- [x] 5.3 Add match-level setup status using existing side, participant, and special-match signals, and verify incomplete matches are identified without changing database validity.
- [x] 5.4 Keep optional presentation gaps as warnings or informational status, and verify missing imagery or generic labels do not block card building.

## 6. Fan-Facing, Picks, And Scoring Safety

- [x] 6.1 Verify public show pages continue to display only real configured records and never render virtual planned slots.
- [x] 6.2 Verify picks for a show with planned count but no real matches do not render virtual match steps or write virtual match payload entries.
- [x] 6.3 Verify picks for a show with both real matches and planned slots render and save predictions only for real records.
- [x] 6.4 Verify scoreboard and scoring calculations ignore planned count and virtual slots, including after score recalculation.
- [x] 6.5 Verify Results operates only on real records and does not require results for virtual planned slots.
- [x] 6.6 Verify existing submitted picks remain valid after planned count is added, changed, or cleared.

## 7. Verification

- [x] 7.1 Run `npx tsc --noEmit --pretty false` and document the result.
- [x] 7.2 Run `npm run lint` and document any existing unrelated lint failures separately from this change.
- [x] 7.3 Run `npm run build` when feasible and document the result or any unrelated build blocker.
- [x] 7.4 Manually verify create show -> post-create prompt -> set up planned matches -> Card Builder on mobile viewport.
- [x] 7.5 Manually verify create show -> skip planned setup -> Card Builder on mobile viewport.
- [x] 7.6 Manually verify promotion-scoped owner/manager behavior, including that a manager cannot preserve a selected show from a different promotion.
- [x] 7.7 Manually verify an existing show with no planned count continues to support Card Builder, Results, Picks, and Scoreboard.
