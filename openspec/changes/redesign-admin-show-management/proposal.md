## Why

BoutPick's promoter/admin Dashboard and Shows pages currently expose show controls, selected-show context, setup editing, and results access in ways that can feel repetitive and buried on mobile. Promoters need the admin entry point to make the next show-management task obvious, especially when creating a first show or entering results during a live event.

## What Changes

- Redesign the Dashboard into a state-aware task surface that prioritizes the next logical action: create a show, continue setup, review an upcoming show, enter live results, or start the next show after completion.
- Add an intentional Dashboard empty/start state when no current, upcoming, or draft show exists, with a dominant "Create New Show" action and concise setup guidance.
- Replace the Dashboard's always-present current-show controls with a Current/Next Show card only when an actionable show exists.
- Make live-show result entry the dominant Dashboard action when an open show appears to be running.
- Redesign the Shows page around event management sections such as current/live, upcoming, draft/setup, and past shows instead of repeatedly emphasizing active-show selection.
- Make "Create New Show" prominent near the top of the Shows page.
- Preserve existing bottom navigation, selected-show context, show creation/editing, Card Builder, Results, Scoreboard, review links, Supabase/RLS behavior, picks, scoring, and database contracts.
- Use existing show data where possible (`starts_at`, `is_over`, readiness inputs, and existing status display) rather than introducing a new database lifecycle state machine.
- Treat mobile as the primary design target while keeping desktop responsive.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `promoter-admin-console`: State-aware Dashboard prioritization and event-management Shows page requirements for the existing admin console.

## Impact

- Affected UI/routes: primarily `src/app/admin/page.tsx`, with possible small extracted admin presentation components if implementation warrants it.
- Affected supporting components: may reuse or adapt `src/components/ShowEditor.tsx` and existing admin readiness, review-link, selected-show, and result-entry logic.
- Promotion scope: must preserve current promotion-scoped visibility and selected-show behavior for super-admins and promotion members.
- RLS/authorization: no RLS policy change is intended; browser Supabase access remains constrained by existing RLS.
- Predictions/submitted picks: no pick payload, submitted-pick, or fan prediction behavior changes are intended.
- Scoring: no scoring rule or recalculation behavior changes are intended.
- Database/schema: no required schema change is intended for the first version.
- Dependencies/API routes: no new dependency, server data layer, API route, or Supabase Edge Function is intended.
