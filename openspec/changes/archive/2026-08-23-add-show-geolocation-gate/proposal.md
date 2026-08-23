## Why

BoutPick is primarily an in-person fan prediction game, and some shows should
be limited to fans who are physically near the venue. This change adds an
optional per-show attendance gate while preserving remote participation for
virtual or unrestricted shows.

## What Changes

- Add optional show-level geolocation configuration for venue name, venue
  address, venue coordinates, permitted radius, and whether verification is
  required.
- Add a fan-facing location verification step before entering picks for shows
  that require it.
- Use one-time browser geolocation with clear explanatory UX, retryable failure
  states, and no exact location persistence by default.
- Allow successful verification to persist for the show for a limited browser
  session/window so attendees are not blocked by later indoor GPS failures.
- Keep ungated shows behaving as they do today.
- Treat the gate as a product participation check, not tamper-proof security.
- Require `/picks?show=...` to respect the gate so direct links cannot bypass
  the intended product flow.

## Capabilities

### New Capabilities

- `show-location-gate`: Optional show-level venue/geofence configuration and
  fan-facing location verification behavior.

### Modified Capabilities

- `picks`: Require location verification before a user can enter or save picks
  for a show that has location verification enabled.

## Impact

- Affects show data/schema, `ShowRow` TypeScript shape, admin show create/edit
  UI, show splash/detail page, `/play`, `/login`, and `/picks`.
- Affects authorization expectations only in that this gate is not an RLS or
  strong anti-spoofing security boundary; existing RLS ownership rules for
  picks remain unchanged.
- Does not affect scoring behavior, scoreboards, submitted pick payload shape,
  or championship scoring.
- Requires schema/RLS migration planning for new `shows` columns; existing
  public read and admin write patterns should be preserved.
- Existing submitted picks remain compatible. The change should not rewrite
  existing `picks.payload` data.
