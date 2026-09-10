## Context

See `proposal.md` for motivation. The admin console is a large client route in `src/app/admin/page.tsx` that already loads `entrants` through the browser Supabase client. The `entrants` table is public-readable and admin-writable under RLS. Existing match/card, rumble, eliminator, Blind Gauntlet, picks, scoring, and scoreboard flows reference entrants by `entrants.id`.

The current schema includes `entrants.name`, `promotion`, `gender`, `image_url`, `logo_url`, `roster_year`, `event_id`, `is_custom`, `created_by`, `status`, and `active`. Existing scripts use the `entrant-images` Supabase Storage bucket and store public object URLs in `entrants.image_url`.

## Goals / Non-Goals

**Goals:**

- Add an admin roster manager inside the existing admin console.
- Let admins create and edit global roster entrants without using the Supabase dashboard.
- Let admins upload or replace wrestler photos and persist public image URLs.
- Keep existing entrant IDs stable when editing wrestler details.
- Keep ordinary removal as inactive/archive behavior, not hard deletion.

**Non-Goals:**

- Do not create a new wrestler table or promotion-to-entrant join table.
- Do not convert text `entrants.promotion` to `promotions.id`.
- Do not change match, pick, score, scoreboard, championship, or public routing behavior.
- Do not support bulk CSV import/export in the first version.
- Do not add automatic image scraping or third-party image search.
- Do not make image upload required.

## Decisions

### Use `entrants` as the source of truth

Create and edit existing `entrants` rows directly. Global roster entries should use `event_id = null`, `is_custom = false`, `status = "approved"`, and admin-selected values for name, promotion, gender, roster year, active status, and image URL.

Rationale: this matches the user's current manual workflow and preserves every existing relationship that points at `entrants.id`.

Alternative considered: introduce a dedicated `wrestlers` table and sync entrants from it. That would be cleaner long term, but it changes the data model and would require migration work across match and prediction setup flows.

### Add the roster manager inside Advanced first

Expose the first version from the admin Advanced area or an equivalent admin-only location. It should be reachable without interfering with the show-first Dashboard, Shows, Card Builder, Results, and Scoreboard flows.

Rationale: roster management is important setup infrastructure, but it is not necessarily part of every show-run workflow.

Alternative considered: make Roster a top-level admin section. This may be worthwhile later, but the first version can avoid increasing primary navigation complexity.

### Upload through the browser Supabase client where possible

Use the existing browser Supabase client for admin file uploads and entrant writes. Store uploaded files in the `entrant-images` bucket using a deterministic, URL-safe path such as `<roster-year>/<slugified-name>-<timestamp-or-id>.<ext>`, then save the public URL to `entrants.image_url`.

Rationale: this follows the current admin pattern of client-side Supabase access under RLS and avoids service-role bypass for normal admin work.

Alternative considered: add an API route using `supabaseAdmin` for uploads. This gives tighter server-side control, but introduces service-role behavior and requires extra authorization hardening.

### Treat Storage policy as an implementation prerequisite

Before implementing upload, verify whether the `entrant-images` bucket exists and whether authenticated admins can upload/update objects safely. If the repository lacks required Storage policy SQL, add a sidecar SQL file that scopes writes to admins and keeps public reads consistent with existing public image usage.

Rationale: database RLS covers `entrants`, but Supabase Storage has separate policies. Upload UI must not depend on broad unauthenticated object writes.

Alternative considered: document manual bucket setup only. That would leave the feature hard to reproduce and easy to misconfigure.

### Edit records in place and avoid hard delete

Editing a wrestler updates the existing entrant row. The ordinary removal action sets `active = false`; hard deletion is not exposed for global roster records in the first version.

Rationale: current matches and specialized event records reference entrants by ID. Hard deleting a shared roster entrant risks breaking historical cards or removing information needed by scoreboards and picks.

Alternative considered: support delete with confirmation. This is risky because `match_entrants`, rumble entries, eliminators, and gauntlet tables have cascading or dependent relationships.

## Risks / Trade-offs

- Storage policies may not currently allow browser uploads -> Verify policies during implementation and add explicit sidecar SQL if needed.
- Existing entrant names may duplicate across promotions, years, or divisions -> Warn on likely duplicates but do not block valid same-name cases unless current constraints require it.
- Updating a wrestler name/photo affects old cards that reference the same entrant -> Communicate that edits update the shared roster record.
- Large rosters can make the admin page heavier -> Reuse existing paged entrant loading where possible and add client-side search/filter for the first version.
- Public image URLs can break if files are overwritten or deleted -> Prefer new uploaded object paths when replacing photos rather than deleting old objects automatically.
- Browser uploads can fail due to file type, size, or policy errors -> Surface errors and avoid saving unusable image URLs.

## Migration Plan

No entrant table migration is expected. Implementation must inspect Storage bucket/policy state. If Storage policy support is missing, add a sidecar Supabase SQL file for `entrant-images` public reads and admin-only uploads/updates before enabling the UI upload path.

Rollback is UI-only unless a Storage policy sidecar is added. Existing entrant rows and uploaded images should remain valid because they continue using the current `entrants.image_url` contract.
