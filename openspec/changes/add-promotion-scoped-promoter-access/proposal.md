## Why

BoutPick currently uses a global admin model where one administrator manages every promotion, show, card, roster, and result. The product is ready for approved promoter accounts that can manage their own assigned promotions without gaining access to unrelated promotions or global platform administration.

## What Changes

- Add approval-based promotion membership so super admins can assign authenticated users to specific promotions as `owner` or `manager`.
- Preserve existing global super admin access through `profiles.is_admin`.
- Allow assigned promotion members to access admin workflows only for their assigned promotions.
- Scope show setup, card building, results entry, review-link management, and non-destructive promotion operations to promotion membership.
- Keep destructive operations such as clearing picks/scores and broad data maintenance super-admin-only in the first version.
- Evolve `entrants` into the global wrestler catalog domain while preserving existing entrant IDs as canonical wrestler identities.
- Add promotion roster curation so promotion members can add existing global wrestlers to a promotion-specific roster without duplicating wrestler records.
- Update admin roster/card-builder behavior so a selected promotion's roster is prioritized while global catalog search remains available.
- Preserve public fan-facing reads, submitted picks, scoring rules, scoreboard calculations, championship behavior, and review-mode behavior except for scoped management permissions.

## Capabilities

### New Capabilities

- `promotion-membership`: Super-admin-approved assignment of users to promotions, including promotion-scoped owner/manager access and membership lifecycle.
- `global-wrestler-catalog`: Treat existing entrants as the shared wrestler catalog and allow promotions to curate a roster subset from that catalog.

### Modified Capabilities

- `authorization`: Replace global-admin-only admin writes with super-admin-or-promotion-member authorization where a table is promotion-scoped, while preserving RLS as the security boundary.
- `promoter-admin-console`: Show assigned promotions to promoter accounts and scope admin workflows to the selected authorized promotion.
- `show-review-links`: Allow assigned promotion members to manage review links for shows in their assigned promotions.

## Impact

- Affects promotion scope, RLS/authorization, admin data access, and database schema.
- Requires new membership and roster-linking tables, helper authorization functions, sidecar SQL/RLS updates, and backfill for existing promotions.
- Requires admin UI changes for super-admin assignment workflows, promotion-scoped navigation, promotion roster curation, and card-builder roster prioritization.
- Requires careful updates to browser Supabase queries and any server routes using `supabaseAdmin` so privileged operations still enforce promotion scope.
- Requires storage policy review if promotion members can upload promotion assets or wrestler images.
- Does not change `picks.payload`, existing submitted picks, scoring rules, live scoreboard calculations, fan-facing public read access, or championship rules.
- Does not introduce open self-service promotion creation, billing, invitation-before-account flows, private promotions, or broad admin-console refactoring.
