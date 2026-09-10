## 1. Baseline Review

- [x] 1.1 Re-read admin preview/share link generation, show lobby primary-action/location-gate logic, and picks stepper/save/draft behavior; verify current integration points before editing.
- [x] 1.2 Re-check active `add-friendly-show-urls` changes and current friendly URL helpers; verify review link generation uses the current route helper behavior without regressing UUID compatibility.
- [x] 1.3 Inspect existing Supabase RLS patterns for admin-owned metadata tables and public/token validation paths; verify the review-link authorization approach preserves RLS as the primary boundary.

## 2. Database And Token Infrastructure

- [x] 2.1 Add sidecar Supabase SQL for `show_review_links` metadata, indexes, expiration/revocation fields, and admin-only RLS management; verify SQL does not expose unauthenticated write access.
- [x] 2.2 Add server-side token generation and hashing utilities; verify raw review tokens are not stored in the database.
- [x] 2.3 Add a narrow server route or RPC-backed path for creating/revoking review links; verify non-admin callers cannot create or revoke links.
- [x] 2.4 Add a narrow server route or RPC-backed path for validating raw review tokens; verify invalid, expired, and revoked tokens return no review authorization.
- [x] 2.5 Add local TypeScript row/result types for review links using existing handwritten type conventions; verify no generated Supabase type dependency is introduced.

## 3. Admin Review-Link Management

- [x] 3.1 Add review link controls to the selected-show admin surface; verify Dashboard, Shows, Card Builder, Results, Scoreboard, and Advanced navigation remain unchanged.
- [x] 3.2 Add an admin action to open direct review mode for the selected show; verify it does not route the admin into ordinary picks save behavior.
- [x] 3.3 Add create/copy behavior for stakeholder review links with a user-friendly label and expiration display; verify a copied link includes the review token.
- [x] 3.4 Add active/expired/revoked review-link display and revoke behavior; verify revoked links no longer validate.
- [x] 3.5 Surface review-link creation, validation, and revoke failures clearly in the admin UI; verify failures do not create partially usable links.

## 4. Show Lobby Review Mode

- [x] 4.1 Add review-token detection and validation to the show lobby route; verify valid review context resolves to the same internal show id and promotion id as the page being viewed.
- [x] 4.2 Add visible review/preview labeling to the show lobby in review mode; verify ordinary fan lobby presentation remains unchanged outside review mode.
- [x] 4.3 Bypass location verification only for valid review contexts; verify no stored location verification is written during review bypass.
- [x] 4.4 Route the review-mode primary action into picks review mode with the same show id and token; verify invalid review contexts fall back to ordinary player requirements.

## 5. Picks Review Mode

- [x] 5.1 Add review-token detection and validation to `/picks`; verify valid review mode can load configured show data without a player `userId`.
- [x] 5.2 Prevent review mode from loading or hydrating an actual user's pick row; verify existing submitted picks are not displayed or modified through review mode.
- [x] 5.3 Prevent review mode from writing `picks`, normal draft keys, or normal last-step keys; verify continuing and finishing the review flow leaves the `picks` table unchanged.
- [x] 5.4 Allow review navigation through all configured events, eliminators, show questions, normal matches, and Blind Gauntlet matches without requiring selections; verify normal picks still enforce existing save validation.
- [x] 5.5 Keep optional in-memory choice interaction in review mode; verify selected choices reset when the review session is reloaded and do not appear on scoreboards.
- [x] 5.6 Add review-complete UI text that distinguishes review completion from submitted picks; verify no scoreboard/championship call treats review completion as participation.

## 6. Compatibility And Security Checks

- [x] 6.1 Verify ordinary player show lobby, location gate, login, picks, draft, save, lock, scoreboard, and championship flows remain unchanged without a valid review token.
- [x] 6.2 Verify non-admin users cannot manage review links, and valid review-link holders cannot access admin operations.
- [x] 6.3 Verify review mode does not alter existing `picks.payload`, scoring source-of-truth behavior, scoreboard calculations, title/championship behavior, API routes outside review-link validation, or Supabase Edge Functions.
- [x] 6.4 Review final `git diff` and verify implementation is scoped to review-link schema/RLS, token validation, admin review controls, lobby review entry, and picks review-mode isolation.

## 7. Browser Verification

- [x] 7.1 In browser as admin, create a review link for a normal show; verify the link opens the lobby in review mode and can continue through all show items without saving picks.
- [x] 7.2 In browser as admin, open direct review mode from the admin preview action; verify no fake picks are saved and ordinary preview/share actions still work.
- [x] 7.3 In browser with a non-admin or signed-out session, open a valid stakeholder review link; verify the reviewer can view the lobby and step through review mode without admin access.
- [x] 7.4 In browser, open a location-gated show through a valid review link; verify geolocation is not requested and no stored location verification is created.
- [x] 7.5 In browser, revoke a review link and verify the same link no longer opens review mode.
- [x] 7.6 In browser, test expired or invalid review tokens; verify they do not bypass ordinary location/auth/picks requirements.
- [x] 7.7 In browser, submit or update real picks through the ordinary picks flow after using review mode; verify real pick behavior and scoreboard behavior are unchanged.

## 8. Final Verification

- [x] 8.1 Run `npx openspec validate add-show-review-links --strict` and verify the change remains valid.
- [x] 8.2 Run `npm run build` and verify it completes or document build issues.
- [x] 8.3 Run `npm run lint` or a scoped lint command and verify it completes or document existing unrelated lint issues.
