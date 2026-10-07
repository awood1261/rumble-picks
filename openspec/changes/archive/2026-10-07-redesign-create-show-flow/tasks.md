## 1. Schema And Types

- [x] 1.1 Add a documented SQL sidecar for show access-code storage, including `access_code_required` and `access_code_hash` on `public.shows`.
- [x] 1.2 Confirm existing show RLS policies allow only global admins or assigned promotion members to update access-code settings through approved admin flows.
- [x] 1.3 Update handwritten TypeScript show row types to include `access_code_required` where the client needs to know whether a gate exists, while avoiding public/client selection of `access_code_hash`.

## 2. Server Helpers And API Routes

- [x] 2.1 Add access-code normalization and hashing helpers for show access codes.
- [x] 2.2 Add an authenticated admin API route for setting, replacing, or clearing a show access code after verifying promotion-scoped show access.
- [x] 2.3 Add a fan-facing validation API route that verifies a submitted code for a selected show without exposing the stored hash.
- [x] 2.4 Add an authenticated geocoding API route that uses a server-only Geoapify API key and validates that the caller is an admin or assigned promotion member.
- [x] 2.5 Add clear API error states for missing auth, promotion access denial, invalid code input, unavailable geocoding configuration, no geocode result, and provider failure.

## 3. Create Show Flow

- [x] 3.1 Replace the current Create Show modal entry with a dedicated mobile-first Create Show flow launched from Dashboard and Shows.
- [x] 3.2 Build the Show Details step with promotion, title, date/time, venue, address, poster URL, and short description.
- [x] 3.3 Keep slug generation automatic during create while preserving duplicate slug validation within the selected promotion.
- [x] 3.4 Build the Fan Experience step with access code first, then email registration, picks close, and confidence points.
- [x] 3.5 Build the Location Verification step using address-driven geocoding, allowed distance choices, and existing location-gate storage fields.
- [x] 3.6 Build the Review step with an editable summary and final Create Show action.
- [x] 3.7 On successful creation, select the new show and route the user toward Card Builder as the next step.
- [x] 3.8 Remove featured `/play` routing and show-over controls from initial creation while preserving those operations after the show exists.

## 4. Picks Access-Code Gate

- [x] 4.1 Load whether the selected show requires an access code in the picks flow without loading the stored hash.
- [x] 4.2 Gate protected shows before pick-entry controls render.
- [x] 4.3 Persist successful validation for the selected show in local component state and optionally session storage.
- [x] 4.4 Block save attempts for protected shows until the selected show has a successful access-code validation.
- [x] 4.5 Preserve existing behavior for ungated shows, location-gated shows, locked shows, anonymous/email auth flows, review links, submitted pick payloads, scoring, and scoreboards.

## 5. Admin Follow-Up Surfaces

- [x] 5.1 Update show-management/edit surfaces to display access-code enabled state without revealing plaintext codes.
- [x] 5.2 Allow authorized managers to replace or clear an access code after the show exists.
- [x] 5.3 Keep poster upload out of scope and retain pasted image URL entry for show posters.

## 6. Verification

- [x] 6.1 Run `npm run lint` and document any pre-existing lint failures if they remain.
- [x] 6.2 Run `npm run build` for broader route/type verification.
- [x] 6.3 Manually verify show creation as a global admin.
- [x] 6.4 Manually verify show creation as an assigned promotion owner/manager and confirm promotion scoping.
- [x] 6.5 Manually verify protected-show picks require the access code before picks and before save.
- [x] 6.6 Manually verify existing ungated picks and scoreboards still work.
- [x] 6.7 Manually verify location verification geocodes after address changes and stores existing latitude/longitude/radius fields.
