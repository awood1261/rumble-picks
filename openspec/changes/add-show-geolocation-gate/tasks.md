## 1. Database And Types

- [x] 1.1 Add a Supabase SQL sidecar migration for the new `shows` geofence columns and verify it preserves existing public-read/admin-write RLS behavior by inspection.
- [x] 1.2 Update `ShowRow` and related local TypeScript show shapes/select lists for the new fields and verify TypeScript references compile during `npm run build`.

## 2. Admin Show Configuration

- [x] 2.1 Extend admin show create state, edit state, Supabase insert/update payloads, and reset/hydration paths for location verification fields and verify saved values are selected back into admin state.
- [x] 2.2 Extend the existing show editor/admin modal UI with controls for enabling location verification, venue name, venue address, venue latitude, venue longitude, and radius, and verify ungated show editing still works.
- [x] 2.3 Add admin-side validation for gated shows so required coordinates and radius are present and valid before save, and verify incomplete gated configuration shows a clear admin error.

## 3. Geofence Utilities

- [ ] 3.1 Add shared client-safe helpers for Haversine distance, geofence pass/fail/inconclusive evaluation, and verification storage keys, and verify helper behavior with focused manual or lightweight local checks.
- [ ] 3.2 Implement short-lived show-scoped browser verification storage without persisting exact latitude/longitude and verify stored data contains only verification metadata.

## 4. Show Verification Experience

- [ ] 4.1 Load location gate fields on the show detail page and render an explanatory verification state for gated shows before the browser permission prompt.
- [ ] 4.2 Implement one-time browser geolocation verification with checking, verified, outside-geofence, permission-denied, unavailable/timeout, imprecise, and unsupported-browser states, and verify retry behavior.
- [ ] 4.3 Preserve existing show splash behavior for ungated shows, signed-in users, signed-out users, email-required shows, and anonymous-profile shows.

## 5. Picks Entry And Save Enforcement

- [ ] 5.1 Load location gate fields in `/picks` for the selected show and block the picks UI when a gated show lacks valid unexpired verification, with a route back to verification.
- [ ] 5.2 Block `handleSave` for gated shows without valid unexpired verification before upserting `picks`, and verify existing lock/confidence/blind-gauntlet validations still apply after verification.
- [ ] 5.3 Preserve existing show-level pick loading, updating, ownership, and `picks.payload` compatibility for ungated shows and verified gated shows.

## 6. Verification

- [ ] 6.1 Run `npm run lint` and address failures introduced by this change.
- [ ] 6.2 Run `npm run build` and address failures introduced by this change.
- [ ] 6.3 Manually verify admin geofence configuration, gated show verification states, direct `/picks?show=...` enforcement, ungated show regression behavior, and submitted pick compatibility.
