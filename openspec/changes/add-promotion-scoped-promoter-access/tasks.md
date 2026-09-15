## 1. Baseline Review

- [ ] 1.1 Inspect current admin data loading, promotion selection, profile admin checks, and destructive actions in `src/app/admin/page.tsx`; verify the notes identify every table and UI path that currently depends on global admin access.
- [ ] 1.2 Inspect existing RLS policies and helper functions in `supabase/schema.sql` and sidecar SQL files; verify every admin-managed promotion-scoped table is listed for policy updates.
- [ ] 1.3 Inspect privileged server routes and helpers that use `supabaseAdmin`, including review-link and championship routes; verify each write path is classified as global-only, promotion-scoped, or unchanged.
- [ ] 1.4 Inspect existing entrant, match participant, card-builder, rumble, eliminator, gauntlet, picks, scoring, and scoreboard references; verify the implementation plan preserves existing `entrants.id` references.

## 2. Database Schema And RLS

- [ ] 2.1 Add sidecar SQL for `promotion_members` with promotion/user references, `owner`/`manager` role constraint, lifecycle metadata, indexes, and uniqueness for active membership; verify the SQL can be applied to a local or staging Supabase database.
- [ ] 2.2 Add sidecar SQL for `promotion_roster_members` linking promotions to existing entrants with active/deactivated lifecycle metadata and uniqueness for active roster membership; verify duplicate active roster links are rejected.
- [ ] 2.3 Add promotion-scoped authorization helper functions such as `can_manage_promotion`, `can_manage_show`, `can_manage_match`, and `can_manage_event`; verify super admins and assigned members return true only for allowed scope.
- [ ] 2.4 Add or update RLS policies for `promotion_members` so super admins can manage memberships and promotion members cannot self-assign, edit, or view unrelated membership data; verify browser Supabase requests enforce the boundary.
- [ ] 2.5 Add or update RLS policies for `promotion_roster_members` so super admins and assigned promotion members can curate assigned rosters only; verify unrelated roster writes are denied.
- [ ] 2.6 Update RLS policies for promotion-scoped admin writes across promotions, shows, events, matches, match sides, match entrants, show questions, eliminators, gauntlet tables, review links, and result-related tables; verify assigned-promotion writes pass and unrelated writes fail.
- [ ] 2.7 Preserve existing public read policies for fan-facing promotions, shows, cards, scoreboards, and related display data; verify unauthenticated public pages still load.
- [ ] 2.8 Review storage policies for promotion assets and entrant images; verify any newly allowed promotion-member uploads are scoped and canonical wrestler image edits remain super-admin-only in V1.
- [ ] 2.9 Add a migration/backfill path for current data so existing super-admin workflows continue to work; verify current promotions remain manageable after migration.

## 3. Authorization Utilities And Server Routes

- [ ] 3.1 Add shared server-side authorization utilities for checking the current user, global super-admin status, and promotion membership before privileged writes; verify unauthorized callers receive a denial before any mutation.
- [ ] 3.2 Update show review-link API routes to allow assigned promotion members to list, create, and revoke links for assigned shows only; verify unrelated promotion access is denied.
- [ ] 3.3 Audit championship API routes and helpers; verify this change does not accidentally grant promotion members new championship management authority unless already allowed by existing behavior.
- [ ] 3.4 Audit any score recalculation or result persistence paths that use privileged access; verify promotion-scoped authorization is explicit or the path remains super-admin-only.

## 4. Admin Access And Promotion Selection

- [ ] 4.1 Update admin bootstrap data loading to distinguish super admins, assigned promotion members, and authenticated users with no admin access; verify each state renders the correct admin access.
- [ ] 4.2 Scope promotion selection so super admins can select all promotions and promotion members can select only assigned promotions; verify direct state or URL attempts for unrelated promotions do not expose management actions.
- [ ] 4.3 Default the admin console to the single assigned promotion when a member has exactly one membership; verify multi-promotion members can switch only among assigned promotions.
- [ ] 4.4 Preserve existing global super-admin experience for all current workflows; verify a super admin can still manage every promotion and access super-admin-only tools.
- [ ] 4.5 Hide or disable promoter admin workflows for authenticated users with no super-admin status and no active promotion membership; verify no management controls are exposed.

## 5. Membership Management UI

- [ ] 5.1 Add super-admin UI for viewing active members and roles for a selected promotion; verify active memberships display accurately.
- [ ] 5.2 Add super-admin UI to assign an existing authenticated user to a promotion as `owner` or `manager`; verify the assigned user gains scoped access after sign-in.
- [ ] 5.3 Add super-admin UI to change a member's role; verify future authorization decisions use the updated role.
- [ ] 5.4 Add super-admin UI to revoke a membership; verify the revoked user loses access to that promotion without affecting unrelated memberships.
- [ ] 5.5 Ensure assignment is limited to existing accounts in V1; verify there is no open public promotion creation or invitation-before-account flow.

## 6. Global Wrestler Catalog And Promotion Roster

- [ ] 6.1 Preserve `entrants` as the canonical global wrestler catalog in code and labels where practical; verify existing match, pick, scoring, scoreboard, rumble, eliminator, and gauntlet references still use existing entrant IDs.
- [ ] 6.2 Restrict canonical global wrestler creation/editing to super admins in V1; verify promotion members cannot edit global wrestler name, image, gender, year, or metadata directly.
- [ ] 6.3 Add promotion roster management for assigned promotion members and super admins; verify a catalog wrestler can be added to and removed or deactivated from a selected promotion roster.
- [ ] 6.4 Update Card Builder participant search to prioritize the selected promotion's active roster; verify roster wrestlers appear first for the selected promotion.
- [ ] 6.5 Keep global catalog search available from Card Builder for missing roster wrestlers; verify selecting a global wrestler outside the roster can add/use that wrestler without creating a duplicate entrant.
- [ ] 6.6 Preserve existing cards when a wrestler is removed from a promotion roster; verify old match participants, results, picks, scoreboards, and scoring displays still resolve the wrestler.

## 7. Scoped Admin Workflows

- [ ] 7.1 Update show creation and editing so promotion members can create or edit shows only under assigned promotions; verify unrelated promotion writes are denied by both UI and RLS.
- [ ] 7.2 Update card-building operations so match creation, edits, ordering, and participant assignment are limited to shows in assigned promotions; verify unrelated show/card writes fail.
- [ ] 7.3 Update result-entry workflows so assigned promotion members can enter non-destructive results for assigned shows; verify scoring behavior and recalculation behavior remain unchanged.
- [ ] 7.4 Keep destructive operations such as clearing picks/scores and broad data maintenance super-admin-only; verify promotion members cannot trigger those actions from UI or direct requests.
- [ ] 7.5 Preserve fan-facing public reads and player flows; verify picks, submitted pick ownership, live scoreboards, and show pages behave as before.

## 8. Browser Verification

- [ ] 8.1 As a super admin, verify all promotions are visible and membership management, roster curation, show setup, card building, results, review links, and super-admin-only destructive tools are available.
- [ ] 8.2 As a promotion member assigned to one promotion, verify only that promotion is visible and ordinary setup, card, results, review-link, and roster workflows work for that promotion.
- [ ] 8.3 As a promotion member assigned to multiple promotions, verify the promotion switcher shows only assigned promotions and each selected promotion scopes data correctly.
- [ ] 8.4 As a promotion member, attempt direct navigation or direct API/browser Supabase writes for an unrelated promotion and verify management access is denied.
- [ ] 8.5 As an authenticated user with no membership, verify the admin console does not expose promotion management workflows.
- [ ] 8.6 As a public or fan user, verify public promotion/show pages, picks entry, review links, and scoreboards continue to load according to existing behavior.

## 9. Final Verification

- [ ] 9.1 Run `npm run lint` and verify it completes successfully or document any pre-existing lint failures.
- [ ] 9.2 Run `npm run build` and verify it completes successfully or document any pre-existing build failures.
- [ ] 9.3 Run `npx openspec validate add-promotion-scoped-promoter-access --strict` and verify the change artifacts are valid.
- [ ] 9.4 Document any remaining manual verification gaps caused by the absence of an automated application test suite.
