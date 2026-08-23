## Context

See `proposal.md` for motivation. The current app stores show configuration
directly on `shows`, edits shows in the client-side admin console under RLS,
routes play entry through `/play` and `/shows/[promotionId]/[showId]`, and
saves show-level picks from `/picks?show=...`. There is no service layer for
show gating and no Supabase Edge Function layer.

Existing pick writes are protected by Supabase Auth and RLS ownership. The
location gate should sit in the user flow before picks and at the save
boundary, but it should not replace RLS or introduce service-key access.

## Goals / Non-Goals

**Goals:**

- Model optional location verification as show-level configuration.
- Let admins configure venue/geofence values using the existing show admin
  patterns.
- Require successful verification before entering and saving picks for gated
  shows.
- Preserve current behavior for ungated, virtual, and remote shows.
- Keep exact player coordinates out of persistent storage by default.
- Make browser permission and failure states understandable and retryable.

**Non-Goals:**

- Strong anti-spoofing, ticketing-grade, financial-grade, or safety-critical
  enforcement.
- Continuous location tracking after a successful check.
- Server-side geospatial enforcement, PostGIS, Edge Functions, or service-key
  verification endpoints.
- A reusable venue directory in the initial implementation.
- Changes to scoring, scoreboards, `picks.payload`, or legacy event-level
  picks.

## Decisions

### Store geofence configuration on `shows`

Add nullable show columns:

- `requires_location_verification boolean not null default false`
- `venue_name text`
- `venue_address text`
- `venue_latitude double precision`
- `venue_longitude double precision`
- `location_radius_meters integer`

Rationale: existing show behavior flags already live on `shows`
(`requires_email_registration`, `lock_picks_at_start`,
`is_featured_play_show`, `is_over`, `use_confidence_points`). A separate
`venues` table would add joins and lifecycle decisions before there is evidence
that venue reuse needs its own model.

Alternative considered: `venues` table referenced by `shows.venue_id`.
Rejected for MVP because it is more structure than the current admin workflow
needs. It remains a reasonable future change if promotions reuse venues heavily
or need venue management.

### Preserve existing RLS shape

Use existing public-read/admin-write policies on `shows`. Adding columns to
`shows` means public clients can read the geofence configuration and admins can
write it through the current policy.

Rationale: the gate is a product participation check. It is not a secret venue
or security boundary. Preserving the current `shows` policy avoids a new API
route or service-key path.

Alternative considered: private geofence configuration plus server-side
verification. Rejected for MVP because browser coordinates are still
client-supplied, so server-side calculation would add complexity without making
the result tamper-proof.

### Use one-time browser geolocation and client-side Haversine distance

Use `navigator.geolocation.getCurrentPosition()` after the player explicitly
starts verification. Use a local distance helper to calculate Haversine
distance between the browser-reported location and the show venue.

Recommended browser options:

- `enableHighAccuracy: true`
- `timeout: 10000`
- `maximumAge: 60000`

Rationale: the app only needs a one-time attendance check. `watchPosition()`
adds privacy, battery, and UI complexity without solving spoofing.

### Apply accuracy tolerance, with an imprecision ceiling

Evaluate success using:

`distanceMeters <= radiusMeters + min(accuracyMeters, 150)`

Treat accuracy above `500` meters as inconclusive and retryable.

Rationale: venue GPS is often degraded indoors or near large buildings, and
the app should avoid rejecting legitimate attendees for small accuracy errors.
Very imprecise locations should not automatically become a pass.

### Persist only a short-lived verification result in browser storage

Store a show-scoped verification result in browser storage, keyed by show id
and user id when available. The stored value should include verification and
expiration timestamps, but not exact latitude or longitude.

Recommended default lifetime: until the later of six hours from verification
or two hours after the configured show start time, capped at twelve hours.

Rationale: a player who verified at the venue should be able to keep playing
even if GPS becomes unavailable inside the building. Continuing to monitor
location is not necessary for the product goal.

### Gate at both splash entry and picks save

The show splash/detail page should present the location verification step
before linking the player into `/picks?show=...`. The picks route should also
check location verification for the selected show and block saving if the
verification is missing or expired.

Rationale: gating only the splash page would let direct `/picks?show=...`
links bypass the feature. Gating the save path protects the meaningful write
boundary while preserving existing RLS ownership checks.

### Keep login behavior compatible

If a signed-out player verifies location first, the verification result should
survive the login/signup redirect for the same browser and show. If the player
signs in first and then reaches a gated show, the show page or picks page
should direct them to verification.

Rationale: current flows support both email and anonymous auth. The gate should
not require a new identity type or changes to profile creation.

## Risks / Trade-offs

- Browser geolocation can be spoofed or manipulated -> Treat the gate as
  product-level attendance friction, not strong security.
- Public `shows` reads expose venue coordinates -> Accept for MVP because venue
  details are player-facing and the feature is not a secret geofence.
- Client-side verification storage can be edited -> Accept for MVP; adding a
  server-verification record can be a future change if abuse becomes material.
- Indoor GPS can be inaccurate -> Use accuracy tolerance, imprecision handling,
  retries, and a limited verification lifetime after success.
- Direct links can bypass splash UI -> Add a `/picks` entry/save guard.
- Admin UI is already large -> Keep edits scoped to existing show editor
  controls and avoid extracting unrelated abstractions.

## Migration Plan

1. Add SQL for new nullable `shows` columns plus a default false boolean.
2. Update handwritten TypeScript show row types and Supabase select lists that
   need location configuration.
3. Extend admin create/edit forms to save and display the new fields.
4. Add client-side geofence helpers and verification storage utilities.
5. Add fan-facing verification UI to the show detail flow.
6. Add `/picks` guard and save blocking for gated shows.
7. Run lint/build and manual verification.

Rollback strategy: disable `requires_location_verification` for affected shows.
If code rollback is required, leave the nullable columns in place; they are
backward-compatible with older app code that does not select them.
