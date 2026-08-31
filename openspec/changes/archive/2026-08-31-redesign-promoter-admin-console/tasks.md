## 1. Baseline And Structure

- [x] 1.1 Re-read `src/app/admin/page.tsx`, `src/components/ShowEditor.tsx`, relevant specs, and this change's design before coding; verify by noting the existing mutation handlers and brownfield behaviors that must be reused.
- [x] 1.2 Identify reusable admin view helpers or component extraction points without changing behavior; verify the app still renders the current admin console before functional UI changes.
- [x] 1.3 Add any derived UI-only helpers needed for readiness, active show summary, route links, and result completion; verify helper output against at least one complete and one incomplete show in browser or with local inspection where browser data is unavailable.

## 2. Show-First Shell

- [x] 2.1 Replace the current table-oriented admin header/tabs with a show-first shell containing promotion/show context and workflow navigation; verify `/admin` opens for an admin user and non-admin/sign-out states still render correctly.
- [x] 2.2 Implement responsive navigation for Dashboard, Shows/Setup, Card Builder, Results, Scoreboard, and Advanced; verify switching sections preserves the selected show and does not trigger unrelated data changes.
- [x] 2.3 Add selected-show summary actions for Preview Show, Open Picks, Open Scoreboard, and Share QR using existing routes; verify each action opens or links to the expected route for the selected show.

## 3. Dashboard And Setup

- [x] 3.1 Build a dashboard overview showing upcoming/active shows, selected show metadata, status chips, readiness summary, and primary actions; verify at least one existing show displays with its promotion, date, venue/location status, picks status, and card count.
- [x] 3.2 Rework create-show and edit-show UI into a clearer basic setup flow while reusing existing show save validation and mutation behavior; verify a draft show can be created and edited without schema changes.
- [x] 3.3 Keep advanced show settings available but visually secondary, including confidence points, featured `/play`, show-over, email registration, lock-at-start, and location gate fields; verify each setting persists as it did before.

## 4. Card Builder

- [x] 4.1 Create a card-builder view showing show-level matches as ordered match cards with match type, sides, participants, championship indicators, and edit affordances; verify existing matches render in show order.
- [x] 4.2 Rework normal match creation so the basic path is prominent and advanced match options are disclosed separately; verify creating singles, tag, and multi-side matches still creates the expected sides.
- [x] 4.3 Preserve participant assignment, side label editing, side image URL editing, add side, remove participant, delete match, and card reorder behavior; verify each operation persists and reloads correctly.
- [x] 4.4 Keep Blind Gauntlet configuration available as advanced match behavior; verify known wrestler, candidate pool, actual entrants, survival result, and final entrant operations still use existing validation.

## 5. Results And Scoring Maintenance

- [x] 5.1 Create a results view optimized for entering winners and result details across show matches; verify winner, finish, match length, and interference updates persist and continue to trigger existing recalculation behavior.
- [x] 5.2 Show match result completion status for the selected show; verify completed and incomplete matches are distinguishable without changing match result semantics.
- [x] 5.3 Move score recalculation and clear picks/scores into a maintenance/destructive area; verify recalculation and clear behavior remain unchanged and confirmation prompts still appear for destructive actions.

## 6. Advanced Domains

- [x] 6.1 Move rumble event creation/editing, rumble entries, eliminations, event activity log, and custom entrant approval into the Advanced area; verify existing event and entrant operations still work for an active event.
- [x] 6.2 Move eliminators and show questions into the Advanced area or advanced subsections; verify creating, editing, deleting, and result entry for both domains still persists.
- [x] 6.3 Keep championship metadata and location gate controls discoverable from advanced cards or setup details without changing the separate championship claim/title subsystem; verify existing championship fields and location fields persist.

## 7. Responsive UI And Visual Polish

- [x] 7.1 Apply the dark BoutPick admin visual direction with amber accents, operational cards, clear icon/action hierarchy, and no gambling/betting language; verify desktop layout visually matches the intended dashboard/card-builder/results concepts.
- [x] 7.2 Make the promoter admin experience usable on mobile with stacked content, compact workflow navigation, readable cards, and accessible primary actions; verify in a browser mobile viewport for Dashboard, Card Builder, Results, and Advanced.
- [x] 7.3 Review text fit, contrast, scrolling, sticky/fixed elements, modals, and destructive-warning placement across desktop and mobile; verify no important controls overlap or become unreachable.

## 8. Final Verification

- [x] 8.1 Run `npm run lint` and verify it completes or document any pre-existing lint issues.
- [x] 8.2 Run `npm run build` and verify it completes or document any build issues.
- [x] 8.3 Manually verify the basic six-match show workflow in browser: create/select show, add matches, assign participants, preview show, open picks, open scoreboard, enter results, and confirm existing scoring controls remain available.
- [x] 8.4 Manually verify brownfield preservation: show-level picks are not altered, legacy event-level advanced features remain accessible, RLS-backed admin access still gates admin writes, and no schema or Edge Function changes were introduced.
