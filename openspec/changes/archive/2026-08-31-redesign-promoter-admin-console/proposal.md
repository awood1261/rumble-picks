## Why

BoutPick's current admin experience is a powerful brownfield operations console, but it exposes too much data-model complexity for promoters who need to create and run a normal wrestling show. The next admin iteration should make the common show setup and live-results workflow clear while preserving the existing implementation behavior and advanced domains.

## What Changes

- Introduce a show-first promoter/admin console experience inspired by the provided concept directions: dashboard, show setup, card builder, results, scoreboard, and advanced areas.
- Provide a clear basic workflow for creating a promotion-scoped show, configuring show details, building a match card, assigning participants, previewing fan-facing routes, and entering results.
- Add readiness/status indicators that summarize whether a show has the core data needed for fan play.
- Surface fan-facing actions from admin, including preview show, open picks, open scoreboard, and share QR, using existing routes.
- Move advanced features behind progressive disclosure, including rumble events, eliminators, Blind Gauntlet, show questions, confidence points, location gate settings, championship metadata, score recalculation, and destructive maintenance.
- Preserve current data models, Supabase/RLS authorization, show-level picks behavior, legacy event-level behavior, scoring rules, scoreboard behavior, and championship subsystem behavior.
- Do not introduce promoter-scoped roles, database migrations, media upload/storage changes, scoring reconciliation, or a new server/API data-access layer as part of this redesign.

## Capabilities

### New Capabilities

- `promoter-admin-console`: Defines the expected promoter/admin console behavior for show-first setup, card building, live result entry, preview/navigation, readiness indicators, advanced feature disclosure, and destructive-operation safeguards.

### Modified Capabilities

- None.

## Impact

- Affected UI/routes: primarily `src/app/admin/page.tsx` and related extracted admin components if introduced.
- Affected supporting code: may reuse existing utilities such as `src/components/ShowEditor.tsx`, `src/lib/locationGate.ts`, `src/lib/scoring.ts`, `src/lib/scoringRules.ts`, and `src/lib/picksTypes.ts`.
- Affected Supabase tables: existing admin reads/writes for `promotions`, `shows`, `events`, `matches`, `match_sides`, `match_entrants`, `entrants`, `rumble_entries`, `eliminators`, `eliminator_entries`, `eliminator_eliminations`, `show_questions`, `picks`, and `scores`.
- Authorization impact: no RLS policy change is intended. Admin access remains enforced by existing Supabase RLS and `profiles.is_admin`.
- Predictions impact: no picks payload or submitted-pick compatibility change is intended.
- Scoring impact: no scoring rule change is intended. Existing recalculation behavior must be preserved, including current brownfield inconsistencies.
- Database impact: no schema change is intended.
