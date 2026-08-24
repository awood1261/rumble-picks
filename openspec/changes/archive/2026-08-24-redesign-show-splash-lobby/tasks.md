## 1. State And Data Preparation

- [x] 1.1 Confirm final CTA labels for locked/live/completed states and verify the chosen labels still route through existing `/picks?show=<showId>` and `/scoreboard?show=<showId>` destinations.
- [x] 1.2 Extend the show detail read only as needed for lobby state, such as `is_over`, and verify the page still loads shows with and without optional show fields.
- [x] 1.3 If implementing "View My Picks", add a minimal RLS-protected current-user pick existence read by `show_id` and `user_id`, and verify signed-out users do not perform this owned read.
- [x] 1.4 Consolidate primary action state derivation in the show detail route or a narrowly scoped helper, and verify each state maps to exactly one dominant action.

## 2. Hero And Lobby Composition

- [x] 2.1 Recompose the show detail page around a mobile-first poster-style hero using dynamic show artwork and promotion branding, and verify a phone-width browser viewport shows show identity before secondary content.
- [x] 2.2 Add concise BoutPick explanatory copy near the hero, and verify the copy avoids gambling, wagering, payout, odds, or betting language.
- [x] 2.3 Add resilient fallbacks for missing artwork, promotion logo, venue name, tagline, and start time, and verify the page remains readable with missing optional data.
- [x] 2.4 Verify long show names and long venue names wrap cleanly without overlapping buttons, status text, or surrounding content.

## 3. Primary Action And Location Gate

- [x] 3.1 Redesign the location-required state into a focused action card using existing location verification behavior, and verify the browser location prompt only appears after the explicit verify action.
- [x] 3.2 Render concise checking, verified, outside-radius, permission-denied, unavailable, timeout, imprecise, unsupported, and invalid-config states, and verify retry or recovery behavior matches the existing gate rules.
- [x] 3.3 Transform the action area after successful verification instead of appending a separate informational block, and verify the player can continue to picks only when the existing gate is satisfied.
- [x] 3.4 Preserve the picks page location guard, and verify direct navigation to `/picks?show=<showId>` still blocks unverified gated shows.

## 4. Secondary Actions And Championship Teaser

- [x] 4.1 Demote show-scoped scoreboard access to a secondary leaderboard-style action, and verify it links to `/scoreboard?show=<showId>`.
- [x] 4.2 Replace the large championship section with a compact teaser using existing championship status data, and verify inaugural, defending, vacant, loading, and unavailable states render without changing championship calculations.
- [x] 4.3 Link the championship teaser to the existing promotion title route when `promotionId` is available, and verify the link target is `/title/<promotionId>`.
- [x] 4.4 Keep previous champion participant information from competing with the primary action, and verify it is either compressed, demoted, or omitted according to the final lobby composition.

## 5. Responsive, Accessibility, And Visual Verification

- [x] 5.1 Verify the lobby at small phone, standard phone, large phone, tablet, and desktop widths in a browser, including that text remains legible over dynamic artwork.
- [x] 5.2 Verify touch targets, keyboard focus, link/button semantics, heading hierarchy, alt text, and screen-reader labels for primary and secondary actions.
- [x] 5.3 Verify reduced visual competition by ensuring only the current required action receives strong card/button treatment in the first viewport.
- [x] 5.4 Run `npm run lint` and document any pre-existing lint failures separately from issues introduced by this change.
- [x] 5.5 Run `npm run build` and verify the production build completes.

## 6. Brownfield Regression Checks

- [x] 6.1 Manually verify signed-out, signed-in without saved picks, signed-in with saved picks, unlocked, locked, live, completed, gated, ungated, and invalid-gate show states in a browser.
- [x] 6.2 Verify existing sign-in redirects still preserve the `show` query parameter and return players to the existing picks flow.
- [x] 6.3 Verify no database schema, RLS policy, scoring logic, picks payload shape, admin flow, Edge Function, or scoreboard calculation changes were made.
