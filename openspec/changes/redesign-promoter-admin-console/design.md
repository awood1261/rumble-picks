## Context

See `proposal.md` for motivation. The current admin experience is a single large client route at `src/app/admin/page.tsx` with substantial inline state, Supabase queries, mutations, validation, result entry, scoring recalculation, and UI rendering. Normal admin operations use the browser Supabase client under RLS; this change should preserve that access pattern.

The visual references emphasize three complementary directions:

- Concept 1: operational results, scoreboard, and advanced management views.
- Concept 2: show setup overview, readiness checklist, card builder, and run-show results.
- Concept 3: dashboard and guided create-show flow.

## Goals / Non-Goals

**Goals:**

- Reframe `/admin` around a selected promotion and show.
- Make the basic show setup path obvious for a normal match card.
- Separate Setup, Card Builder, Results, Scoreboard, and Advanced concerns.
- Provide readiness indicators and fan-facing route actions.
- Keep mobile admin usable through stacked layouts and compact section navigation.
- Preserve existing Supabase tables, RLS behavior, picks payloads, scoring rules, and result persistence.

**Non-Goals:**

- No promoter-scoped role system.
- No database schema or RLS migrations.
- No media upload/storage workflow.
- No scoring rule changes or reconciliation of legacy event-level score persistence.
- No changes to public fan picks, show lobby, scoreboard, or championship contracts except links from admin.
- No rewrite to a new server/API data-access architecture.

## Decisions

### Decision: Keep A Single Admin Route Initially

Implement the redesigned experience inside the existing `/admin` route, with local component extraction where useful.

Rationale: The current admin behavior is concentrated in one route, and splitting routes first would increase risk because state selection, active show/event linkage, and refresh behavior are tightly coupled.

Alternative considered: Create nested admin routes such as `/admin/shows/[id]/card`. This may be useful later, but it should not be the first implementation step for this brownfield change.

### Decision: Use A Show-First Shell With Workflow Sections

The admin console should have a persistent shell with promotion/show context and workflow navigation:

- Dashboard
- Shows / Setup
- Card Builder
- Results
- Scoreboard
- Advanced

Rationale: The current tabs expose domain tables directly. A show-first shell matches promoter tasks while still allowing advanced domains to remain accessible.

Alternative considered: A strict wizard-only flow. That would help first-time setup but would be too limiting for live operations and post-show maintenance.

### Decision: Treat Readiness As Informational

Readiness indicators should summarize missing or complete setup items but should not introduce new hard gates beyond existing validation.

Initial readiness inputs:

- Show details present.
- Promotion associated.
- Start time present when lock/countdown behavior depends on it.
- Match count present.
- Match participants assigned.
- Preview routes available.
- Location gate valid when enabled.
- Picks status derived from current lock/start behavior.

Rationale: The brownfield app has implicit publish/visibility behavior. Adding hard readiness gating would change production behavior.

Alternative considered: Block sharing or picks until all readiness items pass. That would be a product behavior change and should be a separate proposal.

### Decision: Move Advanced Domains Behind Disclosure

Rumble events, eliminators, Blind Gauntlet, show questions, confidence points, location gate, championship metadata, scoring maintenance, event logs, custom entrant approvals, and destructive maintenance should remain accessible but not dominate the basic show setup path.

Rationale: These are real current capabilities, but they are not required for a straightforward six-match show.

Alternative considered: Remove or hide legacy event-level features entirely. That would risk breaking current production workflows and brownfield assumptions.

### Decision: Preserve Current Mutation Semantics

The redesign should reuse existing admin mutation behavior for creating shows, matches, sides, participants, questions, eliminators, events, results, score recalculation, clearing, and deletion.

Rationale: The proposal is a UX/IA redesign, not a data contract migration.

Alternative considered: Introduce server actions or API routes for admin operations. That would create a new authorization and data-access surface that this change does not require.

### Decision: Link To Existing Fan-Facing Routes

Preview and share actions should use existing fan-facing destinations rather than creating new preview-only behavior.

Expected destinations:

- Show lobby: `/shows/[promotionId]/[showId]`
- Picks: `/picks?show=[showId]`
- Scoreboard: `/scoreboard?show=[showId]`
- QR: existing QR route where compatible with current app configuration

Rationale: This provides promoter confidence while preserving fan-facing contracts.

## Risks / Trade-offs

- Large route remains complex -> Mitigate by extracting presentational/admin-section components incrementally without changing data behavior.
- Readiness can imply stronger guarantees than the app enforces -> Label it as status guidance and avoid blocking existing operations.
- Legacy event-level scoring remains confusing -> Keep scoring maintenance in Advanced and document the inconsistency in UI copy where appropriate.
- Custom entrant workflow may still require an active event -> Preserve behavior in the first redesign and surface it as an advanced/legacy constraint.
- Mobile admin may remain dense -> Prioritize show overview, card list, and simple result entry on mobile; keep deep advanced controls available but secondary.
- Visual polish may accidentally obscure destructive actions -> Keep clear destructive sections, confirmation prompts, and red/warning treatment.
- Raw image URLs and geofence coordinates remain technical -> Improve grouping and helper text, but do not introduce upload or geocoding dependencies in this change.

## Migration Plan

1. Implement the redesigned admin UI while preserving existing Supabase reads and writes.
2. Verify current admin operations manually against an existing show and a new draft show.
3. Run `npm run lint` and `npm run build`.
4. Rollback by reverting the admin UI changes; no data migration rollback is expected because this change does not alter schema.

## Open Questions

- Should QR sharing continue to use the existing global QR route, or should a future change create show-specific QR generation?
- Should a later change introduce a dedicated media upload flow for show posters and match side images?
- Should a later change introduce true promotion-scoped promoter roles instead of global admin access?
- Should scoring persistence be reconciled with show-level picks in a separate scoring cleanup change?
