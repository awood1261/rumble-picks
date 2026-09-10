## 1. Baseline And Policy Review

- [x] 1.1 Re-read current admin entrant loading, custom entrant creation, entrant deletion, match participant selection, and advanced admin UI in `src/app/admin/page.tsx`; verify existing `adminView`, `adminTab`, and `entrants` state patterns before editing.
- [x] 1.2 Inspect `supabase/schema.sql` entrant table and RLS policies; verify existing `entrants` admin-write/public-read behavior is preserved.
- [x] 1.3 Inspect current Storage scripts and bucket assumptions for `entrant-images`; verify whether a sidecar Storage policy SQL file is needed for browser admin uploads.

## 2. Data And Upload Utilities

- [x] 2.1 Add or update local TypeScript types for roster-management form state using existing `EntrantRow` fields; verify no generated database type assumptions are introduced.
- [x] 2.2 Add a small URL-safe filename helper for wrestler image uploads; verify uploaded object paths are deterministic enough to inspect and avoid overwriting unrelated images.
- [x] 2.3 If Storage policy support is missing from the repo, add a sidecar Supabase SQL file for `entrant-images` public reads and admin-only uploads/updates; verify no unauthenticated write policy is introduced.

## 3. Roster Manager UI

- [x] 3.1 Add a Roster/Wrestlers entry point in the admin Advanced area or equivalent admin-only location; verify primary Dashboard, Shows, Card Builder, Results, and Scoreboard navigation remains unchanged.
- [x] 3.2 Render a roster list with wrestler name, promotion, division, roster year, active status, and photo status/preview; verify existing entrants appear without requiring schema changes.
- [x] 3.3 Add search and filters for name, promotion, division, roster year, and active status; verify filtering only affects the visible list and does not mutate entrant data.

## 4. Create And Edit Behavior

- [x] 4.1 Add a create-wrestler form with user-friendly labels for wrestler name, promotion, division, roster year, active status, and wrestler photo; verify missing required name is blocked before save.
- [x] 4.2 Save new global roster entrants with `event_id = null`, `is_custom = false`, `status = "approved"`, selected roster fields, and optional `image_url`; verify the new wrestler becomes available in existing card-builder participant selection.
- [x] 4.3 Add an edit flow for existing wrestlers that updates name, promotion, division, roster year, active status, and photo on the same entrant row; verify the entrant ID does not change after editing.
- [x] 4.4 Add inactive/archive behavior for global roster records instead of hard delete; verify deactivated wrestlers remain visible when inactive records are included and are not removed from historical references.
- [x] 4.5 Add duplicate-name warning behavior for likely duplicates in the same promotion/year/division; verify valid same-name cases are not blocked unless existing database constraints reject them.

## 5. Photo Upload Behavior

- [x] 5.1 Add wrestler photo upload for create and edit flows using the browser Supabase client and configured `entrant-images` bucket; verify successful upload stores a public URL in `entrants.image_url`.
- [x] 5.2 Validate basic photo file type before upload; verify unsupported files show a clear error and do not create or update an unusable image URL.
- [x] 5.3 Handle upload or Storage policy failures clearly; verify failed uploads do not silently save an unusable image URL.
- [x] 5.4 When replacing a photo, upload a new object path and update `entrants.image_url`; verify existing object deletion is not required for the first version.

## 6. Compatibility Checks

- [x] 6.1 Verify editing an entrant already used in match participants preserves match references and updates displayed name/photo wherever existing data reads the entrant row.
- [x] 6.2 Verify roster manager changes do not alter picks payloads, scoring, scoreboard calculations, championship behavior, public show routing, API routes, server actions, or Edge Functions.
- [x] 6.3 Review final `git diff` and verify implementation is scoped to admin roster management, optional Storage policy SQL, and related local types/helpers.

## 7. Browser Verification

- [x] 7.1 In browser, open `/admin`, navigate to the roster manager, and verify existing wrestlers are searchable/filterable.
- [x] 7.2 In browser, create a wrestler with name, promotion, division, roster year, active status, and no photo; verify the wrestler appears in the roster and Card Builder participant selection.
- [x] 7.3 In browser, create or edit a wrestler with a photo upload; verify the image preview appears and the saved entrant uses the uploaded public image URL.
- [x] 7.4 In browser, edit an existing wrestler used on a card; verify the card still references that wrestler and shows the updated details.
- [x] 7.5 In browser, mark a wrestler inactive; verify inactive filtering works and the row is not hard-deleted.

## 8. Final Verification

- [x] 8.1 Run `npx openspec validate add-admin-roster-manager --strict` and verify the change remains valid.
- [x] 8.2 Run `npm run build` and verify it completes or document any build issues.
- [x] 8.3 Run `npm run lint` or a scoped lint command and verify it completes or document existing unrelated lint issues.
