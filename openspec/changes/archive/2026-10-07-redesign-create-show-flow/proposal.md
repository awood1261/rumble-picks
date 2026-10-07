## Why

The current Create Show modal exposes event details, fan participation rules, location-gate internals, and lifecycle controls in one dense form. As promoter access expands beyond a single internal admin, show creation needs to feel like a guided setup flow that establishes the event first and leaves lifecycle management to the existing show-management experience.

## What Changes

- Replace the current all-in-one Create Show modal with a dedicated, mobile-first multi-step Create Show flow.
- Organize show creation into focused steps: Show Details, Fan Experience, Location Verification, and Review.
- Keep slug generation automatic during creation while preserving later slug customization in show editing.
- Reword `lock_picks_at_start` as a clearer "Picks close" option without changing existing lock behavior.
- Move operational/lifecycle controls out of Create Show:
  - "Send /play to this show" remains a show-management operation after the show exists.
  - "Mark show as over" remains a lifecycle/results operation after the show exists.
- Add shared show access-code configuration to the Fan Experience step and require the code before a fan can make picks for that show.
- Store access codes securely as hashes rather than showing or storing reusable plaintext codes after save.
- Add server-side venue geocoding so location verification can use venue/address details without asking promoters for raw latitude and longitude.
- Keep show poster entry as a pasted image URL in this version; show-poster uploads are out of scope.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `promoter-admin-console`: Create Show becomes a dedicated multi-step event setup flow with focused steps, review, access-code configuration, geocoding-assisted location setup, and lifecycle controls moved out of creation.
- `picks`: Shows that require an access code gate pick entry before fans can make picks, while preserving existing submitted-pick payloads and scoring behavior.

## Impact

- Affected code:
  - `src/app/admin/page.tsx`
  - likely a new admin Create Show route/component under `src/app/admin`
  - `src/components/ShowEditor.tsx` if shared show-edit/create controls are extracted or reused
  - `src/app/picks/page.tsx` and/or show lobby links that route users into picks
  - Supabase access-code validation helpers/API routes
- Database/schema:
  - Adds access-code storage for shows, preferably `access_code_required` plus `access_code_hash`.
  - No schema change is expected for location verification if geocoding writes existing `venue_latitude`, `venue_longitude`, and `location_radius_meters`.
- RLS/authorization:
  - Admin creation and update of access-code settings must remain limited to global admins or assigned promotion members under existing promotion-scoped management rules.
  - Fan-side access-code validation must not expose stored hashes or bypass existing pick ownership/auth behavior.
- Predictions/scoring:
  - Access code affects whether a fan may enter the picks workflow for a protected show.
  - Existing submitted pick payloads, scoring rules, score recalculation, and scoreboards are not changed.
- Existing submitted picks:
  - Existing picks remain valid and unchanged.
  - If an access code is enabled after picks already exist, the gate should affect future picks access without mutating existing pick records.
- Dependencies:
  - A geocoding provider/API key is needed for server-side address lookup. Geoapify is the recommended default because its free tier does not require billing setup.
  - Poster upload is explicitly out of scope for this change.
