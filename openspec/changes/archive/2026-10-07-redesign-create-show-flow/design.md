## Context

See `proposal.md` for motivation. The current Create Show UI is a modal inside `src/app/admin/page.tsx` that mixes event details, fan registration, pick locking, confidence points, featured `/play` routing, completed-state controls, and raw location-gate coordinates. Creation currently inserts directly through the browser Supabase client under RLS.

Existing show fields already support most of the proposed flow: `promotion_id`, `name`, `slug`, `image_url`, `tagline`, `starts_at`, `requires_email_registration`, `lock_picks_at_start`, `use_confidence_points`, `requires_location_verification`, `venue_name`, `venue_address`, `venue_latitude`, `venue_longitude`, and `location_radius_meters`. Access-code support does not exist yet. Geocoding support does not exist yet.

The repo already has server-side promotion authorization helpers in `src/lib/serverPromotionAccess.ts`, used by review-link APIs. Those helpers are the right model for server operations that need secrets, including code hashing and geocoding.

## Goals / Non-Goals

**Goals:**
- Replace the dense modal with a focused mobile-first create flow that makes event details, fan experience, location verification, and review distinct steps.
- Make access code a show-level gate that happens before picks without changing pick payload or scoring contracts.
- Hide implementation-specific location coordinates from promoters during normal creation.
- Keep creation focused on initial setup and route the user toward card building after the show is created.
- Document SQL changes explicitly.

**Non-Goals:**
- Do not add show poster uploads in this version; poster entry remains a pasted image URL.
- Do not redesign the entire show editor or card builder as part of this change.
- Do not introduce a new lifecycle state machine for shows.
- Do not migrate existing picks, scoring, or legacy event-level behavior.
- Do not change the public scoreboard scoring model.

## Decisions

### Use A Dedicated Create Show Surface

Create a dedicated create-show surface rather than extending the current modal. The likely implementation is a route such as `/admin/create-show` or an equivalent dedicated admin view if route integration proves too disruptive.

Rationale: this gives the flow enough room on mobile, allows browser/back behavior to feel natural, and keeps the Dashboard/Shows primary actions simple. The current modal has too many unrelated controls to remain clear as access code and geocoding are added.

Alternative considered: keep the modal and split it into tabs. That preserves less routing work but still leaves a cramped overlay for a multi-step task.

### Keep Creation Client-Led, Add Server Routes Only For Secret-Bearing Operations

Continue using existing admin/RLS-backed show creation patterns where practical, but use authenticated server routes for operations that require secrets:
- access-code hashing and validation
- venue geocoding through a provider API key

Rationale: most admin writes already happen through the browser Supabase client under RLS. Access-code hashing and geocoding should not expose secrets or hashes to the browser. The existing `serverPromotionAccess` helper provides a local pattern for authenticated server-side checks.

Alternative considered: move all show creation to a server API. That may become worthwhile later, but this proposal can avoid a broader data-access rewrite by limiting server routes to the sensitive pieces.

### Store Access Codes As Hashes On Shows

Add show-level access-code fields, recommended as:
- `access_code_required boolean not null default false`
- `access_code_hash text`

The code should be normalized before hashing in a way that matches the user-facing rules, such as trimming whitespace and using case-insensitive comparison if the UI communicates that behavior. The plaintext code is only available during entry or reset; after save, the admin UI displays enabled/disabled state and allows replacement.

Rationale: the gate is show-scoped, not promotion-scoped, and it affects entry into one show’s picks. Hash-only storage avoids exposing reusable codes through normal reads.

Alternative considered: store plaintext access codes for convenience. That is simpler but makes code leakage much easier because show rows are widely used across the app.

### Validate Access Code Before Picks UI And Before Save

The picks page should fetch whether the selected show requires an access code and gate the picks workflow before rendering pick-entry controls. Successful validation can be cached client-side for the selected show, such as in component state and optionally session storage keyed by show id. Save handlers must also respect the gate so direct UI bypasses do not write picks before validation.

Rationale: the product intent is "access code before picks." Gating only a lobby link would be too easy to bypass if a fan opens `/picks` directly.

Alternative considered: add the gate only to the fan-facing show page. That would preserve the picks page but would not satisfy direct-link behavior.

### Use Geoapify Geocoding API By Default

Use Geoapify as the default provider for server-side venue geocoding, configured with a server-only environment variable named `GEOAPIFY_API_KEY`.

Rationale: Geoapify has a free tier that does not require credit card or billing setup, has a straightforward forward-geocoding API, and is a better fit for early BoutPick usage. Geocoding only happens when the venue address changes and location verification needs coordinates, so usage should stay low.

Alternative considered: Google Geocoding API. It has strong address coverage, but it requires billing setup, which is not appropriate for this phase.

### Geocode When Venue Address Changes

The create flow should attempt geocoding whenever the venue address changes and location verification is enabled, using a debounce or explicit continue-step action to avoid excessive requests. The review step must show whether a geocoded location is available before allowing a location-gated show to be created.

Rationale: this removes latitude/longitude from the normal promoter workflow while still preserving existing stored location fields.

Alternative considered: geocode only after final submit. That reduces requests but creates a worse failure mode because the user reaches the end before learning that location verification cannot be configured.

### Convert Human Distance Choices To Existing Meter Storage

The UI should present simple venue-distance choices in feet, such as 250, 500, and 1000 feet, and store the selected value in existing `location_radius_meters`.

Rationale: the database and location helper already operate in meters, but the target users are more likely to think in feet for venue check-in distance.

Alternative considered: continue asking for meters. That preserves current storage language but keeps the current usability problem.

### Move Lifecycle Controls Out Of Create

Do not show "Send /play to this show" or "Mark show as over" during creation. Those remain available after the show exists through show-management or lifecycle/results controls.

Rationale: these are operational decisions, not initial event setup. Keeping them out of Create Show reduces cognitive load and matches the Dashboard/Shows redesign.

Alternative considered: keep them in an advanced create section. That keeps full power in one place but undermines the goal of simplifying first-time creation.

## Risks / Trade-offs

- Access-code hash added to broadly selected show rows → Do not select `access_code_hash` in client/public queries; expose only `access_code_required` where needed.
- Client-side gate can be bypassed in the browser → Server/database ownership still protects pick writes, but the app should block saves before write; a future hardening option is an RLS-aware access grant table if abuse appears.
- Geocoding provider outage blocks location-gated show creation → Allow non-location-gated show creation to proceed and show a clear retry path for location verification.
- Address geocoding can be imprecise → Show the resolved venue/address summary and allow re-running geocoding after address changes; defer map pin adjustment unless accuracy problems appear in testing.
- Moving creation into a route may need admin state plumbing → Preserve selected promotion/show through URL params or existing local storage behavior and route back to Card after create.

## Migration Plan

1. Add a documented SQL sidecar for show access-code fields and any related constraints.
2. Deploy SQL before code that selects or writes the new access-code fields.
3. Add server-only environment configuration for Geoapify geocoding in deployment settings.
4. Ship code with fallback behavior where shows without `access_code_required` behave as ungated.
5. Rollback code by hiding the new create flow and access-code gate; the new columns can remain nullable/defaulted without affecting existing shows.

## Open Questions

None.
