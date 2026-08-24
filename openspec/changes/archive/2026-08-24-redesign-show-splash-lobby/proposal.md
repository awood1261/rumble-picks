## Why

The current show detail page contains the right systems but presents them as an
information-heavy details screen. For QR-code and first-time live-event users,
the page should quickly establish the show identity, explain BoutPick, and make
the next participation action obvious.

## What Changes

- Redesign `/shows/[promotionId]/[showId]` as a mobile-first Show Lobby.
- Make show artwork, promotion branding, show name, date/status, venue name, and
  countdown/status the dominant first-viewport experience.
- Add concise BoutPick explanatory copy such as "Predict the matches. Earn
  points. Top the leaderboard."
- Replace competing actions with one state-driven primary action area.
- Simplify location verification presentation while preserving the existing
  geolocation algorithm, browser permission flow, session-scoped persistence,
  and picks guard behavior.
- Demote the scoreboard link to a secondary "leaderboard" action on this page
  without renaming routes or changing scoreboard behavior elsewhere.
- Compress the BoutPick Championship presentation into a smaller teaser that
  uses existing championship status data and links to existing title/lineage
  routes where appropriate.
- Preserve dynamic show and promotion branding; do not hardcode concept-image
  event names, cities, wrestler imagery, venues, or championship states.

## Capabilities

### New Capabilities

- `show-lobby`: Player-facing show entry experience, primary action hierarchy,
  location-gate presentation, secondary leaderboard access, and championship
  teaser presentation for a promotion-scoped show.

### Modified Capabilities

- None. Existing picks, scoring, authorization, location-gate, scoreboard, and
  championship contracts are reused rather than changed.

## Impact

- Affected application code is expected to be scoped primarily to
  `src/app/shows/[promotionId]/[showId]/page.tsx`, with optional extraction into
  small nearby/shared presentation components if that keeps the route readable.
- The global navigation in `src/components/NavBar.tsx` should remain the default
  app chrome unless the design explicitly needs page-level adjustments.
- Existing Supabase client-side data access under RLS remains in place.
- No scoring, prediction payload, picks ownership, RLS, admin, Edge Function, or
  database schema change is intended.
- The page may add read-only use of existing data, such as `shows.is_over` or a
  current user's show-level `picks` row, only to drive CTA state.
- Existing submitted picks must remain compatible and unchanged.
