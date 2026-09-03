## 1. Baseline And Schema Planning

- [x] 1.1 Re-read current show routing, link generation, admin show editing, picks verification links, title links, and metadata code; verify all current UUID URL entry points are identified before editing.
- [x] 1.2 Inspect current Supabase schema/RLS policies for `promotions` and `shows`; verify the migration approach preserves public read and admin-only write behavior.
- [x] 1.3 Confirm no picks, scores, championship, Edge Function, or dependency changes are needed; verify with `git diff` after each phase that scope stays limited to routing, links, schema, and related types.

## 2. Slug Schema And Utilities

- [x] 2.1 Add a sidecar Supabase SQL migration for `promotions.slug` and `shows.slug`, including indexes/constraints; verify the SQL handles existing rows without changing IDs or relationships.
- [x] 2.2 Add deterministic backfill behavior for existing promotions and shows with duplicate-safe suffixes; verify duplicate names produce unique slugs.
- [x] 2.3 Add or update TypeScript row types/select lists for promotion and show slugs; verify TypeScript build catches no missing selected fields.
- [x] 2.4 Add shared slug normalization and friendly show URL helper utilities; verify generated slugs are lowercase URL-safe values and generated URLs fall back to UUIDs when slugs are absent.

## 3. Route Resolution

- [x] 3.1 Update promotion show-list resolution so `/shows/<promotion-id>` and `/shows/<promotion-slug>` both load the correct promotion; verify wrong or unknown promotion identifiers show the existing missing/unavailable behavior.
- [x] 3.2 Update show detail resolution so `/shows/<promotion-id>/<show-id>` and `/shows/<promotion-slug>/<show-slug>` both load the same show; verify the show cannot resolve across the wrong promotion.
- [x] 3.3 Update show detail metadata resolution to support slug identifiers; verify page title, description, image, and URL metadata use the resolved show and promotion.
- [x] 3.4 Preserve resolved UUID usage inside show detail flows; verify champion status, champion participants, saved-picks detection, location gate, analytics properties, and picks navigation receive internal IDs.

## 4. Generated Links

- [x] 4.1 Update public show cards and promotion show lists to generate friendly URLs when slugs exist; verify links fall back to UUID URLs when a slug is missing.
- [x] 4.2 Update `/play` redirects to prefer friendly URLs for selected or featured shows; verify redirect behavior still works for featured and single-active-show paths.
- [x] 4.3 Update admin show preview/share links to prefer friendly URLs while preserving picks, scoreboard, and QR links that intentionally use internal show IDs; verify admin links still open the intended show.
- [x] 4.4 Update title/championship show links where they point to show pages; verify championship API calls and title lineage data still use internal IDs.
- [x] 4.5 Update picks location-verification return links to prefer friendly show URLs; verify the picks flow still uses `?show=<uuid>` and stores picks by `show_id`.

## 5. Admin Slug Management

- [x] 5.1 Add admin-visible promotion/show slug fields or read-only friendly URL display where appropriate in the existing admin UI; verify labels are user-friendly and do not expose raw implementation language unnecessarily.
- [x] 5.2 Validate admin-entered slugs for URL-safe format and uniqueness before saving or surface database errors clearly; verify duplicate promotion slugs and duplicate show slugs within the same promotion cannot be saved silently.
- [x] 5.3 If slug editing is supported, warn admins that changing a friendly URL may affect previously shared friendly links; verify the warning appears before or near the editable slug field.

## 6. Browser Verification

- [ ] 6.1 In browser, open a show by UUID URL and friendly URL; verify both load the same show splash and fan-facing actions.
- [ ] 6.2 In browser, open a promotion page by UUID and slug; verify both list the same shows and generated show links prefer friendly URLs when available.
- [ ] 6.3 In browser, verify a wrong promotion/show slug pairing does not load a show from another promotion.
- [ ] 6.4 In browser, verify a fan can navigate from a friendly show URL to picks and submit/update picks without changing the existing `show_id` behavior.
- [ ] 6.5 In browser, verify scoreboard, title/championship, and location-gated show flows still work from a friendly show URL.
- [ ] 6.6 In browser, verify existing UUID QR/shared links remain valid after slugs exist.

## 7. Final Verification

- [x] 7.1 Run `npx openspec validate add-friendly-show-urls --strict` and verify the change remains valid.
- [x] 7.2 Run `npm run build` and verify it completes or document any build issues.
- [x] 7.3 Run `npm run lint` and verify it completes or document existing unrelated lint issues.
- [x] 7.4 Review final `git diff` and verify no application behavior outside friendly show URLs, slug schema/types, and generated links was modified.
