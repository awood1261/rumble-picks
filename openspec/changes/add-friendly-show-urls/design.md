## Context

See `proposal.md` for motivation. Current public show routes use UUID parameters at `/shows/[promotionId]` and `/shows/[promotionId]/[showId]`. Those route pages, metadata layout, Play redirects, show cards, admin preview links, picks verification links, title links, and champion APIs currently assume URL parameters are internal IDs.

Promotions and shows do not currently have slug columns in the known schema/types. The brownfield app uses internal UUIDs as the durable identity for picks, scores, matches, events, location verification, analytics properties, and championship behavior.

## Goals / Non-Goals

**Goals:**

- Add friendly promotion/show URLs without breaking existing UUID URLs.
- Keep UUIDs as the internal identity passed to picks, scoring, scoreboards, location-gate, analytics, and championship flows.
- Add a database migration and backfill strategy for promotion and show slugs.
- Centralize slug generation and show URL generation enough to avoid scattering inconsistent URL rules.
- Preserve public-read/admin-write authorization expectations under Supabase RLS.

**Non-Goals:**

- Do not change `picks` storage, `scores` storage, scoring rules, scoreboard calculations, or champion winner logic.
- Do not remove or invalidate existing UUID URLs.
- Do not introduce slug aliases/history in the first pass.
- Do not redesign show, picks, scoreboard, or admin pages beyond the slug fields/links needed for this behavior.
- Do not normalize legacy event-level picks or database scoring behavior.

## Decisions

### Use stored slugs, not names at request time

Add `slug` fields to `promotions` and `shows` rather than deriving URLs directly from names on every render.

Rationale: names can change, contain punctuation, and collide. Stored slugs make URLs stable and enforceable by database constraints.

Alternatives considered:

- Derive from `name` only: simpler, but unstable and hard to make unique.
- Use only a show slug globally: shorter URLs, but loses the promotion boundary and creates more collision pressure.

### Promotion slugs are global; show slugs are promotion-scoped

Use a unique constraint for `promotions.slug` and a unique constraint for `(shows.promotion_id, shows.slug)`.

Rationale: the desired URL has promotion as the parent path, so show slug uniqueness only needs to hold inside that promotion.

Alternatives considered:

- Global `shows.slug`: simpler lookup, but blocks two promotions from using the same show name.
- No constraints: easier migration, but ambiguous routing and unsafe admin edits.

### Resolve URL identifiers by UUID or slug

Treat route params as identifiers. If an identifier looks like a UUID, resolve by `id`; otherwise resolve by `slug`. The show lookup must verify the resolved show belongs to the resolved promotion.

Rationale: this preserves old URLs while enabling the friendly URL shape without creating parallel route trees.

Alternatives considered:

- Add a separate `/s/<promotion-slug>/<show-slug>` route: avoids ambiguity, but does not meet the desired path shape.
- Replace route folders with slug-only semantics: breaks existing URLs and QR codes.

### Prefer friendly generated links, keep UUID fallback

Generated fan-facing links should use `/shows/<promotion-slug>/<show-slug>` when both slugs are present. If either slug is missing, use the current UUID URL.

Rationale: this allows incremental rollout and avoids blocking existing records if a migration is incomplete.

Alternatives considered:

- Require all links to be slug-only immediately: cleaner, but fragile during migration.
- Keep generating UUID links while accepting slugs: safe, but does not deliver the user-facing value.

### Do not change query-string show IDs in the first pass

Keep routes such as `/picks?show=<uuid>` and `/scoreboard?show=<uuid>` unless a separate proposal scopes friendly URLs for those pages.

Rationale: picks and scoreboard flows are currently keyed by `show_id`. Changing those query params would broaden the change into prediction and scoreboard URL contracts.

Alternatives considered:

- Use slugs in all show-related URLs: more complete, but raises more compatibility and resolution work.

### Admin slug editing is allowed but not alias-backed

Admins may view/edit slugs if the implementation includes fields for it. Slug edits must validate format and uniqueness. The first pass will not retain old slug aliases.

Rationale: editable slugs are useful for promoters, but alias history is a separate routing capability with extra schema and redirect rules.

Alternatives considered:

- Immutable slugs: safest for shared links, but may leave bad generated slugs forever.
- Slug alias table: best compatibility for renamed slugs, but too much scope for this change.

## Risks / Trade-offs

- Existing shared links with UUIDs could break if the resolver assumes slugs only -> Keep UUID resolution and verify UUID URL browser checks.
- A show slug could resolve under the wrong promotion -> Always verify `shows.promotion_id` against the resolved promotion.
- Backfilled slugs could collide -> Use deterministic suffixes and database uniqueness constraints.
- Admin slug edits can break previously shared friendly links -> Communicate by design and defer alias/redirect history to a future change.
- Metadata may show generic content if slug resolution is not updated server-side -> Update the metadata layout resolver alongside the client page resolver.
- RLS could block slug writes or expose unintended writes -> Treat slugs as public-readable metadata and preserve admin-only write policies.
- Schema drift may hide columns not represented in `schema.sql` -> Add a sidecar SQL migration and update handwritten TypeScript row types/selects explicitly.

## Migration Plan

1. Add sidecar SQL for nullable `slug` columns on `public.promotions` and `public.shows`.
2. Backfill existing records with normalized, unique slugs.
3. Add uniqueness constraints/indexes after backfill.
4. Update RLS expectations only if existing admin write policies do not already cover the new columns.
5. Update TypeScript row types and Supabase select lists to include slugs where links are generated or identifiers are resolved.
6. Deploy application code that resolves both UUID and slug identifiers.
7. After verification, generated links can prefer friendly URLs while UUID URLs remain supported.

Rollback: keep UUID URL resolution in place. If slug link generation causes issues, generated links can temporarily fall back to UUIDs without changing picks, scores, or show records. Database rollback should avoid dropping slug columns until any generated friendly links in circulation are understood.

## Open Questions

- Should UUID show URLs redirect to friendly URLs when slugs exist, or should they load in place indefinitely? The spec allows either as long as behavior is preserved.
- Should admin slug edits show a warning that changing a slug may break already shared friendly links? Recommended during implementation, but not required for the core routing contract.
