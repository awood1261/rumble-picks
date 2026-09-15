## Context

See `proposal.md` for motivation. BoutPick currently treats `profiles.is_admin` as global admin authority. Browser-side admin operations use the Supabase publishable client and rely on RLS policies that mostly check `public.is_admin(auth.uid())`. Some server routes and championship helpers use `supabaseAdmin`, which bypasses RLS and therefore need explicit authorization checks when they manage scoped data.

The existing data model already scopes shows to promotions through `shows.promotion_id`. Many child records scope indirectly through `show_id`, `match_id`, or `event_id`. Existing entrant records are widely referenced by match participants, rumble entries, eliminators, gauntlet configuration, picks, scoreboards, and display flows.

## Goals / Non-Goals

**Goals:**

- Add an approval-based promotion membership model while preserving global super-admin access.
- Scope admin UI data loading and writes to assigned promotions for non-super-admin promoters.
- Enforce promotion boundaries in RLS and privileged server routes.
- Preserve public fan-facing read behavior and current player pick/scoring contracts.
- Treat `entrants` as the global wrestler catalog and add promotion roster curation without duplicating wrestler identities.
- Keep destructive platform operations super-admin-only in the first version.

**Non-Goals:**

- Do not allow open self-service promotion creation.
- Do not introduce billing, public marketplace moderation, or invitation-before-account workflows.
- Do not rename the `entrants` table or replace existing entrant foreign keys.
- Do not change `picks.payload`, scoring rules, scoreboard calculations, or championship rules.
- Do not refactor the large admin route into a new architecture as part of this change.

## Decisions

### Add `promotion_members` as the authorization source for promoter access

Use a new membership table with `promotion_id`, `user_id`, `role`, lifecycle metadata, and an active/revoked state. `profiles.is_admin` remains the super-admin marker.

Rationale: a promotion can have more than one promoter account, and one user can manage more than one promotion. A single `promotions.owner_id` would not cover assignment, transfer, and collaboration cleanly.

Alternative considered: add only `created_by` or `owner_id` to `promotions`. That is simpler but too limited for admin assignment and multi-user management.

### Use helper functions for promotion-scoped RLS

Add helper functions such as:

- `public.can_manage_promotion(uid, promotion_id)`
- `public.can_manage_show(uid, show_id)`
- `public.can_manage_match(uid, match_id)`
- `public.can_manage_event(uid, event_id)`

Policies should use these helpers alongside `public.is_admin(auth.uid())`.

Rationale: many admin-managed tables are indirectly scoped to a promotion. Helper functions keep policies readable and reduce repeated join mistakes.

Alternative considered: duplicate joins in every policy. That increases the chance of inconsistent authorization across child tables.

### Keep destructive operations super-admin-only

Promotion members can manage ordinary setup and results for assigned promotions, but clearing picks/scores and broad maintenance remain super-admin-only in v1.

Rationale: destructive operations affect submitted picks, score history, and trust. Keeping them global-admin-only reduces risk while promoter access is introduced.

Alternative considered: allow promotion owners to clear their own show data. This may be useful later, but it needs stronger audit and confirmation behavior.

### Treat `entrants` as the global wrestler catalog without renaming it

Keep existing entrant IDs as canonical wrestler identities. Add a promotion roster linking table rather than duplicating entrant rows per promotion.

Rationale: existing match, rumble, eliminator, gauntlet, pick, scoring, and scoreboard references already depend on `entrants.id`. Renaming or replacing the table would create broad compatibility risk.

Alternative considered: create a new `wrestlers` table and migrate references. That is a larger schema migration and should not be combined with promotion-scoped access.

### Add `promotion_roster_members` for roster curation

Use a linking table between promotions and global entrants. Promotion members can add/remove links for assigned promotions, while super admins remain responsible for canonical catalog edits in v1.

Rationale: promoters need fast access to the wrestlers they commonly book without recreating the global inventory. A curated subset improves card-builder UX and preserves shared wrestler identity.

Alternative considered: allow each promotion to create duplicate wrestler records. That fragments the catalog and makes cross-promotion identity/image maintenance harder.

### Scope admin UI queries before rendering controls

The admin console should load available promotions based on super-admin status or active membership. Non-super-admin users should see only assigned promotions and should not be able to select unrelated promotions through UI state.

Rationale: RLS remains the security boundary, but UI scoping prevents confusing failures and reduces accidental exposure of unrelated admin surfaces.

Alternative considered: keep loading all public promotions and rely on write failures. That would be a poor promoter experience and risks overexposing admin context.

### Update service-role routes with explicit scoped authorization

Routes that use `supabaseAdmin` and manage promotion-scoped data must verify the caller's Supabase user and check super-admin status or promotion membership before performing writes.

Rationale: service-role access bypasses RLS. Promotion boundaries must be enforced in code wherever service-role access is used for management.

Alternative considered: move every operation to browser Supabase under RLS. That is preferable where feasible, but tokenized/server flows may still require a narrow privileged route.

## Risks / Trade-offs

- Policy gaps on indirectly scoped child tables -> Use helper functions, enumerate every admin-managed table, and verify unrelated-promotion writes fail.
- Server routes bypass RLS -> Centralize scoped authorization checks and audit every `supabaseAdmin` write path.
- Existing schema drift -> Use sidecar SQL and verify against actual app-used columns rather than relying only on `supabase/schema.sql`.
- Global catalog data quality could degrade if promoters edit canonical wrestlers -> Keep canonical global wrestler edits super-admin-only in v1.
- Card builder could become slower if it loads global catalog and roster naively -> Prioritize selected promotion roster first and keep global catalog search explicit.
- Destructive operations may still be needed by promoters -> Keep them super-admin-only initially and consider a future audited owner-only change.

## Migration Plan

1. Add `promotion_members` and `promotion_roster_members` sidecar SQL, indexes, role/status constraints, and RLS.
2. Add authorization helper functions for promotion, show, match, and event management.
3. Backfill existing promotions so the current super-admin account can manage them as needed; preserve `profiles.is_admin` for global access.
4. Update RLS policies for promotions, shows, events, matches, match sides, match entrants, show questions, eliminators, gauntlet tables, review links, roster links, and result-related writes.
5. Update storage policies if promotion members can upload promotion-scoped assets.
6. Update admin console loading so super admins see all promotions and promotion members see assigned promotions only.
7. Add super-admin membership management UI.
8. Add promotion roster curation UI and update card-builder participant selection to prioritize the selected promotion roster.
9. Update service-role routes, especially review-link management, to enforce scoped authorization.
10. Verify fan-facing public reads, picks, scoreboards, scoring, and championship flows remain unchanged.

Rollback should disable promotion-member admin UI access first, then restore global-admin-only policies if needed. The new membership and roster-link tables can remain unused while rollback is investigated.

## Open Questions

- Should future versions allow promotion owners to request or create pending global wrestler catalog entries?
- Should future versions add email invitation before account creation, or keep assignment limited to existing accounts?
- Should promotion owners eventually receive audited destructive operations for their own shows?
