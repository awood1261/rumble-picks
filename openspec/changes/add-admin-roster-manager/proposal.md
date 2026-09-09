## Why

Creating or updating wrestlers currently requires manual context switching between Supabase Storage and the `entrants` table. Admins need a roster management workflow inside BoutPick so they can add wrestler records and photos without editing database rows by hand.

## What Changes

- Add an admin roster manager for viewing, searching, filtering, creating, and editing wrestler/entrant records.
- Support creating global roster entrants with user-friendly fields for wrestler name, promotion, division, roster year, active status, and wrestler photo.
- Support uploading a wrestler photo from the admin UI and saving the resulting public URL to `entrants.image_url`.
- Support replacing an existing wrestler photo and editing basic entrant details.
- Support marking wrestlers inactive instead of hard-deleting roster records.
- Preserve existing entrant usage in matches, rumble entries, eliminators, picks, scoring, and scoreboards.
- Preserve the existing `entrants` table as the source of truth; do not introduce a separate wrestler table in this first version.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `promoter-admin-console`: Adds admin roster management for existing wrestler/entrant records and photo uploads.

## Impact

- Affects admin UI, likely `src/app/admin/page.tsx`, and may add small admin-only helper components/utilities.
- Affects Supabase `entrants` reads/writes through the existing browser Supabase client and RLS model.
- Affects Supabase Storage usage for the existing `entrant-images` bucket or a documented equivalent bucket/path.
- May require a sidecar SQL file for Storage bucket/policy setup if current Storage policies do not allow admin uploads safely.
- Does not change prediction payloads, score calculation, scoreboard behavior, match/entrant foreign keys, championship behavior, public show routing, or existing submitted picks.
- Does not introduce hard deletion, a new wrestler table, API routes, server actions, Edge Functions, or service-role upload behavior unless implementation proves client-side Storage/RLS cannot support the workflow safely.
