## Context

The admin console is a large client route in `src/app/admin/page.tsx` that uses browser Supabase under RLS. Dashboard, Shows, Card Builder, Results, Scoreboard, and Advanced share local state such as `selectedShowId`, `activeShow`, `activePromotion`, and `adminView`. The current `activeShow` is the selected show, or the first loaded show when no selection exists; loaded shows are ordered by creation time rather than by actionable lifecycle.

The `shows` data model already includes `starts_at`, `status`, and `is_over`, but app behavior treats `starts_at`, `is_over`, readiness inputs, and pick-lock settings as more meaningful than `status`. New shows are created with `status: "draft"`, but there is no authoritative lifecycle state machine today.

Readiness already exists in the admin page for the selected show. Result completion also exists for selected-show matches. The redesign should reuse those ideas while avoiding schema, RLS, scoring, pick payload, and fan-route changes.

## Goals / Non-Goals

**Goals:**

- Make the Dashboard choose and display the next logical management action from existing visible shows.
- Make the Shows page feel like event management rather than repeated active-show selection.
- Preserve the existing selected-show context so Card Builder, Results, Scoreboard, review links, and editing still operate correctly.
- Improve mobile-first access to create-show, continue-setup, review, and enter-results actions.
- Keep the implementation compatible with promotion-scoped promoter access and super-admin access.

**Non-Goals:**

- Introduce a new show lifecycle schema or migration.
- Change RLS policies, authorization boundaries, server data access, scoring rules, or pick payloads.
- Redesign the Results workflow itself beyond making it easier to reach from Dashboard/Shows.
- Replace the existing admin route architecture with a new route or service layer.
- Remove Advanced tools or existing destructive-operation safeguards.

## Decisions

### Decision: derive UI management state from existing show data

Use a derived UI state such as `empty`, `setup`, `upcoming`, `live`, and `completed` for presentation and action prioritization. Base it on existing show fields and related setup data:

- `is_over` marks completed shows.
- `starts_at` separates scheduled/upcoming shows from undated setup shows.
- existing readiness data helps distinguish setup from review/prepare.
- result/match data helps display completion context where already loaded.

Rationale: this delivers the desired UX without adding a schema migration or pretending the existing `status` field is authoritative.

Alternative considered: create a new canonical lifecycle enum. That would make state explicit, but it would require schema, backfill, write-path changes, and careful compatibility work. It is unnecessary for the first version.

### Decision: separate "recommended Dashboard show" from selected show when needed

The Dashboard should be allowed to recommend the most actionable show without constantly forcing `selectedShowId` to change while the admin is using another workflow. The selected show should change when the admin activates a show-specific Dashboard or Shows card action.

Rationale: automatically replacing the selected show based on time/readiness could surprise admins who intentionally selected another show in Card Builder or Results.

Alternative considered: always set `selectedShowId` to the derived primary show. That is simpler but risks context jumps.

### Decision: keep the existing admin route and bottom navigation

Implement the redesign inside the existing admin route and state model. Add local helper functions and small presentational components as needed, initially close to `src/app/admin/page.tsx`.

Rationale: the current architecture is a brownfield route component with many embedded admin operations. A route split or new service layer would add risk unrelated to the requested UX.

Alternative considered: break Dashboard, Shows, Card, and Results into separate App Router pages. That may be useful later, but it is not required for this change.

### Decision: preserve selected-show semantics for workflow actions

When a Dashboard or Shows card action opens setup, card building, results, scoreboard, or review for a show, it must set the selected-show context before invoking the workflow. Review-link actions that currently assume `activeShow` may need to accept an explicit show id or only be exposed for the current selected show.

Rationale: Card Builder, Results, and Scoreboard already rely on selected-show state. The redesign should improve navigation without changing persistence behavior.

Alternative considered: pass show ids through every admin subview independently. That would be a larger state-management change and is unnecessary for v1.

### Decision: reuse readiness but avoid requiring complete readiness for navigation

Readiness should inform labels, status copy, and checklist/progress display, but incomplete readiness should not block existing admin actions unless current validation already blocks them.

Rationale: the admin console currently allows iterative setup. The redesign should guide promoters, not introduce hidden blockers.

Alternative considered: enforce a strict setup checklist before previewing or running a show. That would be a product behavior change and could break existing operational flexibility.

## Risks / Trade-offs

- Ambiguous live state without an end time or explicit live flag → Treat `starts_at <= now && !is_over` as an in-progress signal for v1, but keep "mark show over" available and call out stale in-progress shows in implementation copy or secondary state when the start time is not recent.
- Match counts/readiness for non-selected shows may require broader data loading → Prefer lightweight per-show summaries or carefully reuse already visible show/card data instead of loading excessive records into the mobile UI.
- Existing `status` may conflict with derived state → Use `status` as display context only when useful, not as the sole decision source.
- Multiple promotions can make "current show" ambiguous → Include promotion context on cards or provide a promotion filter/context summary where needed.
- Review-link actions may be selected-show dependent → Parameterize actions by show id where practical, or ensure the selected show is updated before the action runs.
- Large `admin/page.tsx` can become harder to maintain → Extract small presentational components only when they reduce local complexity, avoiding unrelated architecture work.

## Migration Plan

1. Implement the UI-state derivation and show-summary helpers without changing schema or RLS.
2. Replace Dashboard content with the state-aware empty/current/next-show presentation.
3. Replace Shows content with event-management sections and show cards while preserving the existing show modal and selected-show behavior.
4. Keep existing Card Builder, Results, Scoreboard, Advanced, and show-edit persistence paths intact.
5. Roll back by reverting the admin UI changes; no database rollback is expected.

## Resolved Planning Choices

- A show is treated as in progress when `starts_at <= now && !is_over`; stale in-progress copy may be used when the start time is not recent, but the primary result-entry behavior remains available.
- Completed-show actions should prioritize the admin Results view for management review and may expose the public scoreboard as a secondary action where links already exist.
- Multi-promotion admins should see a combined Dashboard recommendation with promotion context on show cards; a separate promotion filter is optional only if needed to preserve clarity.
