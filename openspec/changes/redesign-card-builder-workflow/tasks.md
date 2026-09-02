## 1. Baseline And Safety Checks

- [x] 1.1 Re-read `src/app/admin/page.tsx`, `src/components/EntrantCard.tsx`, `openspec/specs/promoter-admin-console/spec.md`, this change's spec delta, and this change's design; verify the current Card Builder handlers for match creation, side creation, participant assignment, ordering, result entry, and recalculation are identified before editing.
- [x] 1.2 Confirm no database, RLS, API route, server action, Edge Function, or dependency change is needed for the first implementation; verify with `git diff` after each phase that only intended frontend/OpenSpec files changed.
- [x] 1.3 Identify whether to keep the redesigned Card Builder inside `src/app/admin/page.tsx` or extract small presentational components; verify any extraction preserves existing props, state, and Supabase mutation behavior.

## 2. Card Overview

- [ ] 2.1 Replace the always-expanded Card Builder match list with compact ordered match summaries; verify in browser that the selected show's matches display in `order_index` order with match number, match type, sides, participants, and edit action.
- [ ] 2.2 Show entrant imagery from existing entrant records in each match summary and side detail where available; verify in browser that matches with participant images render those images and matches without images still render usable placeholders or text.
- [ ] 2.3 Add visible championship, main-event, Blind Gauntlet, and incomplete/readiness indicators to match summaries; verify in browser against at least one ordinary match, one championship/main-event match, and one incomplete match where available.

## 3. Focused Match Editing

- [ ] 3.1 Add state and UI so only one existing match editor is open at a time; verify opening one match closes or de-emphasizes other expanded editors without changing selected show state.
- [ ] 3.2 Move match name, side labels, side images, championship metadata, champion side, and main-event controls into the focused editor using existing update handlers; verify each edited field persists and reloads correctly.
- [ ] 3.3 Keep participant add/remove operations inside the focused editor using existing `match_entrants` behavior; verify adding and removing participants persists and does not recreate the match or unrelated sides.
- [ ] 3.4 Keep side add/edit behavior available as advanced match configuration; verify adding a side and renaming a side persists for multi-side or custom scenarios.

## 4. Add Match Workflow

- [ ] 4.1 Rework Create Match into a low-friction add-match panel that prioritizes match type and participants before advanced details; verify creating singles, tag, triple-threat, fatal-four-way, ladder, and multi-person matches still creates the expected side count.
- [ ] 4.2 Make roster selection searchable or easier to scan while reusing existing entrant data and filters; verify admins can select existing entrants without manually entering image URLs.
- [ ] 4.3 Keep match kind, roster year, roster gender, championship fields, and main-event flag available as common or advanced settings; verify each setting still persists on newly created matches.
- [ ] 4.4 Preserve Blind Gauntlet creation validation for known wrestler and 3-to-20 candidate entrants; verify invalid gauntlet setup still shows an error and valid setup persists.

## 5. Results Separation

- [ ] 5.1 Remove winner and result-entry controls from the default Card Builder match surface; verify Card Builder no longer presents winner, finish actual, match length actual, interference actual, or gauntlet actual result controls as the default editing path.
- [ ] 5.2 Confirm the Results workflow still exposes winner, finish, match length, interference, clear-result, and supported special-match result operations; verify each operation persists and continues to trigger existing recalculation behavior.
- [ ] 5.3 Verify existing matches that already have result fields continue to show their completion/result status where appropriate without losing data.

## 6. Readiness And Preview

- [ ] 6.1 Add derived card readiness checks for missing sides, missing participants, incomplete special-match setup, missing optional imagery, generic side labels, and incomplete championship display data; verify readiness is calculated from existing loaded data without writing readiness state.
- [ ] 6.2 Distinguish blockers, warnings, and informational items in the Card Builder UI; verify blockers do not create new database restrictions beyond existing validation.
- [ ] 6.3 Add prominent Fan Preview access from Card Builder using the existing fan-facing show route; verify the link opens the selected promotion-scoped show route.

## 7. Responsive And Accessibility Pass

- [ ] 7.1 Verify desktop Card Builder layout against the concept direction: ordered card overview, compact summaries, clear edit affordance, amber/dark visual language, and no betting/gambling language.
- [ ] 7.2 Verify mobile Card Builder layout in browser: summaries stack cleanly, participant imagery remains readable, edit controls are reachable, and Add Match remains usable.
- [ ] 7.3 Verify keyboard usability for match edit open/close, add-match controls, participant selection, save buttons, and reorder controls.
- [ ] 7.4 Verify text fit, contrast, scrolling, modal/drawer reachability, and destructive action placement across desktop and mobile.

## 8. Final Verification

- [x] 8.1 Run `npm run lint` and verify it completes or document the existing unrelated lint issues.
- [x] 8.2 Run `npm run build` and verify it completes or document any build issues.
- [ ] 8.3 Manually verify the six-match show setup flow in browser: select show, add matches, assign participants, reorder matches, mark championship/main event, preview fan page, and confirm Card Builder keeps result entry out of the default surface.
- [ ] 8.4 Manually verify brownfield preservation: existing submitted picks still load, Results still drives scoring fields, scoreboard still reads current data, admin writes remain RLS-backed, and no schema or Edge Function changes were introduced.
