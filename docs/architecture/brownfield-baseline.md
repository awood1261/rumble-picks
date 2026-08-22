# BoutPick Brownfield Architecture Baseline

> Generated during the initial OpenSpec adoption.
> This document describes the application architecture as observed
> on August 22, 2026.
>
> This is reference documentation, not a product specification.
> When this document conflicts with the current implementation,
> verify the implementation before making changes.

Analyzed read-only. I did not modify application code.

**System Shape**
BoutPick is a Next.js 16 App Router app backed by Supabase Postgres/Auth/Storage. The dominant pattern is client-side route components using the publishable Supabase client under RLS, with a smaller server-only champion/title subsystem using a service-role-style `SUPABASE_SECRET_KEY`.

Key anchors:
- App config/deps: [package.json](/Users/alexwood/Dev/rumble-picks/package.json:1), [next.config.ts](/Users/alexwood/Dev/rumble-picks/next.config.ts:1)
- Supabase schema/RLS: [schema.sql](/Users/alexwood/Dev/rumble-picks/supabase/schema.sql:1)
- Client Supabase: [supabaseClient.ts](/Users/alexwood/Dev/rumble-picks/src/lib/supabaseClient.ts:1)
- Admin Supabase: [supabaseAdmin.ts](/Users/alexwood/Dev/rumble-picks/src/lib/supabaseAdmin.ts:1)
- Shared domain types: [picksTypes.ts](/Users/alexwood/Dev/rumble-picks/src/lib/picksTypes.ts:1)
- Scoring: [scoring.ts](/Users/alexwood/Dev/rumble-picks/src/lib/scoring.ts:109), [scoringRules.ts](/Users/alexwood/Dev/rumble-picks/src/lib/scoringRules.ts:1)

**Next.js Structure**
Routes are mostly App Router `page.tsx` client components:
- `/`, `/play`, `/shows`, `/shows/[promotionId]`, `/shows/[promotionId]/[showId]`
- `/login`, `/profile`, `/picks`, `/scoreboard`, `/scoreboard/[userId]`
- `/admin`
- `/champion/[promotionId]`, `/title`, `/title/[promotionId]`
- API routes only exist under `/api/champion/*`.

Most UI/data behavior is concentrated in very large pages:
- Admin console: [admin/page.tsx](/Users/alexwood/Dev/rumble-picks/src/app/admin/page.tsx:200)
- Picks flow: [picks/page.tsx](/Users/alexwood/Dev/rumble-picks/src/app/picks/page.tsx:183)
- Live scoreboard: [scoreboard/page.tsx](/Users/alexwood/Dev/rumble-picks/src/app/scoreboard/page.tsx:227)
- Public user picks: [scoreboard/[userId]/page.tsx](/Users/alexwood/Dev/rumble-picks/src/app/scoreboard/[userId]/page.tsx:225)

Server components are mainly used for metadata/title/champion pages, not for the core interactive workflows.

**Supabase And Data Access**
The database is defined as cumulative SQL plus sidecar SQL files, not formal timestamped migrations. Tables include profiles, promotions, shows, events, show_questions, eliminators, entrants, matches, match_sides, match_entrants, rumble_entries, picks, scores, gauntlet tables, champion code/claim tables.

Data access patterns:
- Browser pages import `supabase` and call `.from(...)` directly.
- Admin UI still uses the browser client; authorization depends on RLS plus `profiles.is_admin`.
- Champion/title server utilities use `supabaseAdmin`, bypassing RLS.
- Scripts use Supabase REST/Auth/Storage APIs directly with `SUPABASE_SECRET_KEY`.

RLS shape:
- Public read for promotions, shows, events, questions, entrants, matches, match sides/entrants, gauntlet data, rumble entries, scores.
- User-owned insert/update/delete for picks.
- User-owned profile updates.
- Admin-only writes for most content/result/scoring tables.
- Authenticated users can insert custom pending entrants for an event.

**Auth And Authorization**
Auth is Supabase Auth with email/password, sign-up, anonymous sign-in, and profile metadata sync. `profiles` are created by a DB trigger on `auth.users`.

Admin authorization is boolean `profiles.is_admin`, checked:
- In DB via `public.is_admin(auth.uid())`.
- In client UI before showing `/admin` controls.
- In `NavBar`/`AdminConsoleLink`.

Important constraint: client-side admin checks are UX only; actual protection is RLS. Future admin features should preserve DB policy enforcement.

Champion claim APIs are different: they use server admin access and accept user/guest IDs from request bodies after validating a champion code. That domain should be treated separately from normal RLS-backed user writes.

**Core Domain Model**
Promotions:
- `promotions`: id, name, image_url.
- Shows are promotion-scoped via `shows.promotion_id`.
- Routes use `/shows/[promotionId]` and `/shows/[promotionId]/[showId]`.

Shows:
- `shows`: name, image_url, promotion_id, starts_at, status, requires_email_registration, lock_picks_at_start, is_featured_play_show, is_over, use_confidence_points.
- `tagline` is used in app code but not present in the main `schema.sql`, an inconsistency to capture.

Matches:
- `matches` belong to both `event_id` and optional `show_id`.
- `match_sides` model pickable sides/teams.
- `match_entrants` attach entrants to sides.
- Match types include singles/tag/multi-side and `blind_gauntlet`.
- Championship metadata lives on matches: `is_championship`, `championship_name`, `championship_image_url`, `champion_side_id`.

Wrestlers/entrants:
- `entrants` are global roster records, optionally event-specific for custom entrants.
- Key fields: name, promotion, gender, image_url, logo_url, roster_year, event_id, is_custom, created_by, status, active.
- Custom entrants are pending and user-created, but admin can approve/manage entrants.

Predictions:
- `picks.payload` is JSONB, show-level for current app behavior.
- Payload includes `rumbles`, `eliminators`, `question_picks`, `match_picks`, `match_confidence_picks`, `match_finish_picks`, `match_length_picks`, `match_interference_picks`, `blind_gauntlet_picks`.
- Legacy event-level picks still exist through `event_id` uniqueness and scripts/DB function.

Scoring:
- App scoring is TypeScript in `calculateScore`.
- Rules are fixed constants in `scoringRules`.
- Admin recalculation writes `scores` rows.
- Public scoreboard recomputes live scores in browser from picks and actuals, not simply reading `scores`.
- Database has older `recalculate_scores_for_event()` trigger-based rumble scoring. Treat this as legacy/event scoring unless verified otherwise.

Scoreboard:
- `/scoreboard` is live show scoreboard with periodic refresh, rank deltas, ticker/countdown UI.
- `/scoreboard/[userId]` displays public user picks/results.
- Scores are display-derived from `picks` plus actual data, with profiles joined client-side.

Championships:
- Champion claims use separate tables: `champion_card_codes`, `champion_claims`, and `v_latest_champion_claims`.
- Title lineage is computed in [championData.ts](/Users/alexwood/Dev/rumble-picks/src/lib/championData.ts:753), based on completed shows, winners, claims, and promotion scope.
- `/title` redirects to a featured promotion when available.

Analytics:
- PostHog is initialized in [instrumentation-client.ts](/Users/alexwood/Dev/rumble-picks/instrumentation-client.ts:1).
- `next.config.ts` rewrites `/ingest/*` to PostHog.
- Events include show card clicks and picks saved.

**Images And Storage**
Images are stored as URLs in DB fields and served directly or with `next/image`. Supabase Storage public URLs are hard-coded in several places for belts/default wrestler assets. Storage scripts manage entrant image upload/cache headers. `next.config.ts` allows the current Supabase project host plus SmackDown Hotel image hosts.

**UI And TypeScript**
Conventions:
- Tailwind v4 via `@import "tailwindcss"`.
- Dark zinc/black/amber visual language.
- Components are mostly Tailwind utility-heavy, with occasional inline `style jsx`.
- Shared components exist, but much UI remains embedded in route pages.
- TypeScript is strict, but Supabase types are handwritten rather than generated.
- Path alias `@/*` exists but many imports use relative paths.

**Testing And Config**
There is no test runner configured and no app test suite found. Available scripts are only `dev`, `build`, `start`, `lint`.

Environment/config patterns:
- Required browser env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- Server/admin env: `SUPABASE_SECRET_KEY`.
- Site/analytics: `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_POSTHOG_TOKEN`, `NEXT_PUBLIC_VERCEL_ENV`.
- `APP_BASE_URL` is hard-coded to `http://192.168.1.9:3000`, used for QR and auth redirect. This is a non-obvious local constraint/risk.

**Inconsistencies / Ambiguities**
- `shows.tagline`, `matches.match_length`, and `matches.match_interference` are used by code but absent from the main schema file.
- Current show-level picks coexist with legacy event-level picks and DB trigger scoring.
- Admin recalculation queries picks by `event_id`, while current picks saving uses `show_id`; this needs care before changing scoring.
- Champion APIs trust body-supplied user/guest IDs.
- Large client pages are the real domain modules; there is little service-layer separation.
- No Edge Functions exist under `supabase/functions`.
- No generated DB types, migrations, or automated tests.

**Preserve These Patterns**
Future agents should preserve:
- Supabase RLS as the primary authorization boundary.
- Show-level picks payload shape unless a spec explicitly migrates legacy event behavior.
- Promotion-scoped routing for shows/title/champion flows.
- `calculateScore` as the source of app scoring truth.
- Admin result edits triggering recalculation.
- Public read access for show/event/match/scoreboard data.
- Handwritten domain types unless the project explicitly adopts generated Supabase types.
- Existing Tailwind/dark visual language.

**Where To Put This**
`AGENTS.md` should contain:
- Tech stack, commands, no-test warning.
- “Do not bypass RLS except server-only champion/admin utilities.”
- App Router conventions: mostly client components for interactive workflows.
- Key files for domains/scoring/schema.
- Warning about show-level vs event-level picks/scoring.
- Warning that schema SQL may lag app-used columns.
- Environment variables and hard-coded `APP_BASE_URL` caveat.

`openspec/config.yaml context` should contain:
- Short project overview and domain glossary.
- Current architecture: Next App Router + Supabase + RLS + Storage + PostHog.
- Canonical scoring and prediction model summary.
- Database migration reality: cumulative SQL, sidecar SQL, no generated DB types.
- Constraints future specs must respect: promotion scope, show-level picks, RLS admin model, no existing tests.

Future OpenSpec domain specs should cover:
- promotions, shows, matches, entrants, picks, scoring, scoreboard
- admin content/results management
- auth/profile/player identity
- championships/title lineage/champion claims
- images/storage
- analytics
- legacy event-level rumble behavior only if it remains supported or needs migration.