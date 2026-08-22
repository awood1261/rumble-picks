# BoutPick Codex Instructions

BoutPick is an existing brownfield application. Treat the current implementation
as the source of truth. Before introducing a pattern, inspect nearby code and
preserve existing behavior unless an approved OpenSpec change explicitly changes
it. Keep edits scoped; avoid unrelated refactors, formatting churn, and broad
architecture cleanup.

## Stack And Commands

- Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4.
- Supabase provides Postgres, Auth, RLS, and Storage.
- PostHog browser analytics is initialized through `instrumentation-client.ts`.
- Important commands:
  - `npm run dev`
  - `npm run build`
  - `npm run lint`
- There is currently no automated application test suite or configured test
  runner. Do not claim tests passed unless you actually ran an available command.

## Repository Map

- `src/app/`: Next.js App Router routes and API routes.
- `src/components/`: shared UI components used by route pages.
- `src/lib/`: shared Supabase clients, domain types, scoring, champion helpers,
  avatar/profile utilities, and app config.
- `supabase/`: cumulative schema SQL plus sidecar SQL files and seed data.
- `scripts/`: operational Supabase REST/Auth/Storage scripts.
- `openspec/`: OpenSpec configuration and future specs/changes.
- `docs/architecture/brownfield-baseline.md`: brownfield architecture reference.

Key files:
- `src/lib/supabaseClient.ts`: browser Supabase client using publishable env vars.
- `src/lib/supabaseAdmin.ts`: server-only admin Supabase client using
  `SUPABASE_SECRET_KEY`; bypasses RLS.
- `src/lib/picksTypes.ts`: handwritten shared app/domain row and payload types.
- `src/lib/scoring.ts`: app scoring implementation.
- `src/lib/scoringRules.ts`: fixed point values.
- `src/lib/championData.ts`: server-side championship/lineage data helpers.
- `supabase/schema.sql`: main schema/RLS reference, but not complete by itself.

## Next.js Conventions

- Core interactive workflows are mostly client components that import
  `supabase` directly and rely on RLS:
  - `src/app/admin/page.tsx`
  - `src/app/picks/page.tsx`
  - `src/app/scoreboard/page.tsx`
  - `src/app/scoreboard/[userId]/page.tsx`
- Large route components currently contain substantial domain logic. Do not
  assume there is a clean service layer; inspect the route page before changing
  related behavior.
- Server components are mainly used for metadata/title/champion pages.
- API routes currently exist only under `src/app/api/champion/*`.
- There are currently no Supabase Edge Functions under `supabase/functions`.

## Supabase And Authorization

- RLS is the primary authorization boundary. Client-side admin checks are UX
  only; database policies must enforce access.
- Most public event/show/match/scoreboard data is readable by everyone.
- User-owned writes apply to profiles and picks.
- Admin writes are controlled by `profiles.is_admin` through
  `public.is_admin(auth.uid())` in RLS policies.
- The admin UI uses the browser Supabase client under RLS. Preserve that model
  unless a spec explicitly changes it.
- `supabaseAdmin` is server-only and bypasses RLS. Use it only when the existing
  server-side pattern calls for it, such as champion/title helpers or a
  deliberately designed server-only operation. Never move service-key access into
  client code.

## Brownfield Hazards

1. Show-level and legacy event-level picks coexist. Current app flows save
   show-level picks with `picks.show_id`, while legacy scripts/schema paths still
   use `picks.event_id`.
2. App scoring and legacy database scoring coexist. Treat
   `src/lib/scoring.ts` and `src/lib/scoringRules.ts` as the current app scoring
   source of truth; `public.recalculate_scores_for_event()` in
   `supabase/schema.sql` is legacy event-level rumble scoring unless verified.
3. `supabase/schema.sql` does not contain every column currently used by the
   app. Known app-used columns not fully represented there include
   `shows.tagline`, `matches.match_length`, and `matches.match_interference`.
4. Domain logic is embedded in large route components. Prefer matching local
   patterns over extracting abstractions during unrelated work.
5. RLS is the real security boundary.
6. Server-side Supabase admin access bypasses RLS and must be used sparingly.
7. There is no automated application test suite.
8. There are no Supabase Edge Functions.

## Domain Guidance

- Promotions scope shows through `shows.promotion_id`, with routes like
  `/shows/[promotionId]`, `/shows/[promotionId]/[showId]`, and
  `/title/[promotionId]`.
- Predictions live in `picks.payload` JSONB. Current show-level payloads include
  rumbles, eliminators, show questions, match winners, confidence ranks, finish
  picks, match length/interference, and blind gauntlet picks.
- Public scoreboards recompute live scores from picks plus actuals in the
  browser; they do not simply display the `scores` table.
- Admin result edits often trigger score recalculation. Preserve recalculation
  behavior when changing result-entry flows.
- Championship/title logic is separate from normal picks flows and lives mostly
  in `src/lib/championData.ts` plus `src/app/api/champion/*`.

## TypeScript And UI

- TypeScript is strict, but Supabase database types are handwritten rather than
  generated. Keep local row/payload types aligned with actual selected columns.
- The `@/*` alias exists, but the codebase often uses relative imports. Follow
  nearby style.
- Tailwind v4 is used via `src/app/globals.css`.
- The visual language is dark zinc/black with amber accents. Existing UI is
  utility-class heavy, with some inline `style jsx`.
- Shared components exist, but many controls are embedded directly in route
  pages. Avoid redesigning UI while making functional changes.

## Environment And Storage

- Required public Supabase env vars:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- Server/admin env var:
  - `SUPABASE_SECRET_KEY`
- Site/analytics env vars include:
  - `NEXT_PUBLIC_SITE_URL`
  - `NEXT_PUBLIC_POSTHOG_TOKEN`
  - `NEXT_PUBLIC_VERCEL_ENV`
- `src/lib/appConfig.ts` currently hard-codes `APP_BASE_URL` to a LAN URL used
  by QR/auth redirect flows. Treat this as a known configuration caveat.
- Images are commonly stored as public Supabase Storage URLs in database fields
  and rendered directly or through `next/image`. Storage maintenance scripts live
  in `scripts/`.

## Working Rules

- Read the existing implementation before modifying related behavior.
- Prefer small, behavior-preserving changes that fit the current route/component
  structure.
- Do not introduce new auth, scoring, data-access, routing, or state-management
  patterns unless an OpenSpec change explicitly calls for them.
- Do not normalize legacy event-level picks/scoring into show-level behavior
  opportunistically.
- Do not update schema, RLS, or scoring casually; those changes require explicit
  product intent and careful verification.
- When changing code, run the most relevant available verification command,
  usually `npm run lint` and, for broader changes, `npm run build`.
