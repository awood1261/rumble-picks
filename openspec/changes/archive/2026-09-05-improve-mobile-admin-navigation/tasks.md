## 1. Baseline Review

- [x] 1.1 Re-read the current admin shell in `src/app/admin/page.tsx` and verify the desktop aside, mobile tab row, selected show state, and active view switching behavior before editing.
- [x] 1.2 Review the current `promoter-admin-console` spec and this change's delta spec; verify the implementation scope is limited to mobile navigation/context and desktop regression prevention.

## 2. Mobile Shell Layout

- [x] 2.1 Hide the desktop left panel on mobile while preserving it on `lg` and wider viewports; verify mobile no longer shows the full sidebar before admin content and desktop still shows the sidebar.
- [x] 2.2 Adjust the admin main layout spacing for mobile after removing the sidebar footprint; verify the selected admin section appears near the top of the mobile viewport.
- [x] 2.3 Keep compact mobile promotion/show context available in the header or a lightweight disclosure; verify promoters can identify or change the selected show on mobile.

## 3. Mobile Navigation

- [x] 3.1 Replace or revise the current mobile horizontal section row with compact mobile navigation that keeps Dashboard, Shows, Card, Results, Scoreboard/Scores, and Advanced/More reachable; verify each control changes `adminView`.
- [x] 3.2 Ensure the active mobile section is visually distinct after a section is selected; verify the selected view remains obvious without scrolling back to the former sidebar.
- [x] 3.3 If using fixed bottom navigation, add mobile bottom padding so form controls and destructive actions are not covered; verify the bottom of each admin view remains reachable.

## 4. Behavior Preservation

- [x] 4.1 Verify promotion and show selection still preserve the existing selected-show behavior across admin views.
- [x] 4.2 Verify no Supabase queries, RLS behavior, API routes, scoring logic, picks logic, database schema, or Edge Functions are changed by this UI-only navigation update.
- [x] 4.3 Review `git diff` and verify changes are limited to admin responsive layout/navigation or small presentational helpers needed for that layout.

## 5. Browser Verification

- [x] 5.1 In a mobile browser viewport, open `/admin` and verify the desktop left panel is absent from the top of the page.
- [x] 5.2 In a mobile browser viewport, switch through Dashboard, Shows, Card, Results, Scoreboard/Scores, and Advanced/More; verify the active section is clear and content appears without excessive vertical sidebar space.
- [x] 5.3 In a mobile browser viewport, verify the selected promotion/show context remains visible or easily accessible and changing shows still updates the admin content.
- [x] 5.4 In a desktop browser viewport, verify the existing left sidebar remains available and section switching still works.
- [x] 5.5 In a mobile browser viewport, scroll to the bottom of long admin views and verify fixed or sticky navigation does not block important buttons or form controls.

## 6. Final Verification

- [x] 6.1 Run `npx openspec validate improve-mobile-admin-navigation --strict` and verify the change remains valid.
- [x] 6.2 Run `npm run build` and verify it completes or document any build issues.
- [x] 6.3 Run `npm run lint` or a scoped lint command and verify it completes or document existing unrelated lint issues.
