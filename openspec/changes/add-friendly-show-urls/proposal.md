## Why

BoutPick show URLs currently expose promotion and show UUIDs, which makes public show links difficult for fans and promoters to read, share, or recognize. Friendly promotion/show URLs make show pages feel polished while preserving existing UUID links and the current internal ID-based data model.

## What Changes

- Add stable, URL-safe slugs for promotions and shows.
- Generate canonical fan-facing show URLs in the form `/shows/<promotion-slug>/<show-slug>`.
- Continue supporting existing UUID-based promotion and show URLs for compatibility with existing links, QR codes, browser history, and analytics referrals.
- Resolve friendly URL identifiers to internal UUIDs before loading show data or calling existing picks, scoring, scoreboard, location-gate, and championship flows.
- Prefer friendly URLs when generating fan-facing show links from admin, show lists, play redirects, metadata, and related navigation.
- Define slug uniqueness and duplicate-name behavior.
- Add admin-visible slug editing or slug display where needed for promoters to understand and manage shareable URLs.
- Add a schema migration/backfill plan for existing promotions and shows.

## Capabilities

### New Capabilities

- `friendly-show-urls`: Public and admin-facing behavior for friendly promotion/show URLs, slug uniqueness, UUID compatibility, and ID resolution.

### Modified Capabilities

- None.

## Impact

- Affects promotion scope because show URLs will identify both the promotion and the show by slug or UUID.
- Affects database schema by adding slug fields and uniqueness constraints/backfill behavior for promotions and shows.
- Affects RLS/authorization because slug fields are public-readable routing data but admin-controlled writable metadata.
- Does not change the `picks.payload` shape, pick ownership, score calculation, scoreboard contract, or championship source-of-truth behavior.
- Existing submitted picks remain keyed by internal `show_id`; friendly URLs must resolve to that same ID before any pick-related action.
- Existing UUID URLs must remain valid to avoid breaking current links and QR codes.
- No new dependencies, server actions, API routes, or Supabase Edge Functions are expected unless implementation discovers a brownfield constraint that requires one.
