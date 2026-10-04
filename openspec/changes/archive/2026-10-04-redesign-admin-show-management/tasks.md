## 1. State Derivation And Show Summaries

- [x] 1.1 Add local admin helpers for deriving show management state from existing visible show data and verify no schema, RLS, API, or server data-access changes are introduced
- [x] 1.2 Build show summary data for Dashboard and Shows cards, including promotion context, date/time, venue/location, readiness context, match count where available, and result context where available; verify summaries render for selected and non-selected visible shows without breaking selected-show state
- [x] 1.3 Add action helpers that set `selectedShowId` before opening setup, card, results, scoreboard, or review workflows; verify each action opens the intended workflow for the chosen show

## 2. Dashboard Redesign

- [x] 2.1 Replace the existing Dashboard hero/current-show surface with a no-actionable-show start state and verify it shows a dominant create-show action while hiding edit-show and enter-results primary actions
- [x] 2.2 Add the state-aware Current/Next Show card for setup, upcoming, live, and completed states; verify the primary CTA changes between Continue Setup, Review/Prepare, Enter Results, and Create New Show as appropriate
- [x] 2.3 Make live/in-progress shows visually distinct and make Enter Results the dominant mobile action; verify a started non-over show reaches the Results view in one tap from Dashboard
- [x] 2.4 Preserve secondary actions for edit, preview/review, picks, scoreboard, and QR where existing links are available; verify these actions preserve existing behavior and do not create submitted picks

## 3. Shows Page Redesign

- [x] 3.1 Redesign the Shows page top area around event management with a prominent create-show action and verify the existing create-show modal still creates and selects the new show
- [x] 3.2 Group visible shows into current/live, upcoming, draft/setup, and past sections; verify empty sections are handled cleanly and the page remains understandable with no shows
- [x] 3.3 Render show management cards with state-appropriate actions and verify draft/setup, upcoming, live, and completed cards route to the correct existing admin workflows
- [x] 3.4 Preserve promotion context for multi-promotion admins and promotion members; verify scoped promoters only see/manage their assigned promotion shows under existing RLS behavior

## 4. Compatibility And Existing Workflow Preservation

- [x] 4.1 Verify Card Builder, Results, Scoreboard, Advanced, ShowEditor, and review-link management still operate on the selected show after Dashboard and Shows actions
- [x] 4.2 Verify existing readiness logic remains guidance-only and does not block show editing, card building, previewing, or results entry beyond existing validation
- [x] 4.3 Verify completed-show handling uses existing `is_over` behavior and preserves public play, scoreboard, scoring, championship, and pick compatibility
- [x] 4.4 Verify no submitted pick payloads, scoring rules, score recalculation behavior, Supabase policies, or database schemas are changed

## 5. Mobile And Desktop Verification

- [x] 5.1 Run `npm run lint` and document that it remains blocked by existing unrelated lint errors in `src/app/scoreboard/[userId]/page.tsx` and `src/components/PicksSections.tsx`; admin redesign code has no blocking lint errors
- [x] 5.2 Run `npm run build` and verify it completes successfully
- [x] 5.3 Manually verify mobile Dashboard states for no shows, draft/setup show, upcoming/ready show, live/in-progress show, and completed-only shows
- [x] 5.4 Manually verify mobile Shows page grouping, show-card actions, create-show CTA, and selected-show switching
- [x] 5.5 Manually verify desktop Dashboard and Shows pages remain responsive and existing sidebar/bottom navigation behavior does not regress
