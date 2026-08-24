## Context

See `proposal.md` for motivation. The current show detail route at
`src/app/shows/[promotionId]/[showId]/page.tsx` is a client component that
loads public show and promotion data, auth state, location verification state,
championship status, and champion participants. It already routes to
`/picks?show=<showId>` and `/scoreboard?show=<showId>`.

The redesign should work within that brownfield shape. The existing app uses
client-side Supabase reads under RLS for player-facing interactive pages, has no
formal shared Button/Card system, and currently keeps substantial page behavior
inside route components.

## Goals / Non-Goals

**Goals:**

- Recompose the existing show detail screen into a Show Lobby with a stronger
  mobile-first hierarchy.
- Preserve existing data sources, route destinations, location verification
  mechanics, picks locking, RLS ownership, and championship APIs.
- Make the primary action deterministic from already available state, with only
  narrow read-only additions where needed.
- Keep the concept image as visual direction while keeping all event,
  promotion, venue, and championship content dynamic.

**Non-Goals:**

- No database redesign or required schema migration.
- No scoring, picks payload, scoreboard, admin, authentication, or geofencing
  algorithm changes.
- No application-wide terminology change from "scores" to "leaderboard".
- No introduction of a broad UI component library or design system.

## Decisions

### Keep the show detail route as the integration point

Implement the lobby through `src/app/shows/[promotionId]/[showId]/page.tsx`,
optionally extracting small presentation helpers or components only if the route
would otherwise become harder to maintain.

Alternative considered: creating a new `/lobby` route or redirect flow. That
would add navigation complexity and duplicate the existing `/play` redirect,
show metadata, geolocation, and championship integration points.

### Use existing dynamic visual assets

Use `shows.image_url` as the poster-like hero artwork, `promotions.image_url` as
promotion branding, existing BoutPick logo assets from `public/images`, and the
current belt image constant or equivalent existing championship asset. Missing
assets should fall back to a neutral BoutPick black/gold treatment.

Alternative considered: adding new static event art or wrestler imagery. That
would violate the requirement to support every promotion and show dynamically.

### Preserve global navigation unless it conflicts with composition

The app-level `NavBar` already provides hamburger navigation, centered BoutPick
branding on mobile, and sign-in/profile state. Prefer reusing it over building a
bespoke top bar inside the show page.

Alternative considered: hiding the global nav and recreating the concept's top
chrome locally. That risks duplicating auth/menu behavior and creating route
inconsistency.

### Derive primary CTA from existing state

The CTA should be derived from:

- auth checked / signed-in state
- show lock state from `starts_at` and `lock_picks_at_start`
- show completion from `is_over` when selected
- location-gate state from existing verification helpers
- optional existence of the current user's show-level pick row

If `VIEW MY PICKS` is implemented, the page should perform a minimal
RLS-protected read from `picks` by `show_id` and current `user_id`. It should not
read or interpret the full prediction payload unless needed for the label.

Alternative considered: always using `MAKE YOUR PICKS` for signed-in players.
That is simpler but misses the requested already-submitted-picks state.

### Treat "leaderboard" as page-local wording

The redesigned lobby may label the secondary score action as "View Leaderboard"
while continuing to link to the existing `/scoreboard?show=<showId>` route.

Alternative considered: renaming scoreboard terminology across the app. That is
outside this change and could affect routes, copy, and user expectations.

### Keep championship as a teaser

Use the existing championship status API response to render a compact teaser for
`inaugural`, `defending`, and `vacant` states. Link to `/title/[promotionId]`
when `promotionId` is available. Do not change champion calculation or title
claim behavior.

Alternative considered: loading deeper lineage data into the lobby. That would
make the teaser compete with the primary show action and broaden API impact.

## Risks / Trade-offs

- Dynamic artwork may reduce text contrast -> use strong overlays and test with
  missing, bright, dark, and busy show images.
- Long show or venue names may break the poster layout -> use constrained type,
  wrapping, and mobile-first spacing instead of viewport-scaled font sizes.
- Adding pick-existence CTA state adds one client read -> keep the query minimal
  and rely on existing RLS ownership.
- `is_over` is not currently selected by the show detail route -> if used for
  `VIEW RESULTS`, add it to the existing show select and type usage without
  changing schema.
- Location failure states can become verbose -> map each existing status to
  concise title/body/action copy while preserving retry behavior.
- The current route already has substantial domain logic -> keep extraction
  limited and avoid opportunistic refactors.

## Migration Plan

This is a presentation-focused change. Deploy by updating the show detail route
and any narrowly scoped presentation helpers. Rollback is reverting those UI
changes; no data migration or backfill is expected.

## Open Questions

- Should the completed-show CTA text be "View Results" while still routing to
  the existing scoreboard, or should it use existing scoreboard terminology?
- Should `FOLLOW LIVE` appear only after `starts_at` when `is_over` is false, or
  whenever picks are locked and results may be accumulating?
