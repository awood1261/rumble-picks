## Context

See `proposal.md` for motivation. The existing admin console generates fan-facing preview links with `buildShowHref(activeShow, activePromotion)` and opens ordinary picks with `/picks?show=<show-id>`. The current show lobby owns location verification and routes eligible users to picks. The current picks page is a client route that loads show data, hydrates existing `picks.payload`, writes local draft/last-step state, and upserts `picks` on step continuation.

Review mode crosses admin, lobby, picks, authorization, and database concerns. It also overlaps with the active friendly URL change because normal public show links may use friendly slugs, but review validation must still resolve to the internal `shows.id`.

## Goals / Non-Goals

**Goals:**

- Provide a review experience that can be opened directly by admins and shared with non-admin stakeholders.
- Keep review interactions non-persistent and isolated from `picks`, local draft keys, scoring, scoreboards, and championships.
- Bypass location verification only for valid review contexts.
- Let admins create, copy, inspect, and revoke show review links.
- Keep review links scoped to a single show and promotion.

**Non-Goals:**

- Do not grant stakeholders admin access.
- Do not create stakeholder accounts, per-recipient permissions, comments, or approval workflows in the first version.
- Do not change the canonical show-level picks payload shape.
- Do not alter scoring, scoreboard, championship, or public player eligibility behavior.
- Do not replace ordinary fan preview, picks, scoreboard, or QR links.

## Decisions

### Use tokenized share links rather than a plain preview query parameter

Create a review-link record for a show and expose a high-entropy token in the share URL. The token should validate to one active, unexpired link for one show.

Rationale: the link bypasses geolocation and normal pick submission requirements for review mode, so it needs lifecycle control. A plain `?preview=true` style parameter would be too easy to discover and would not be revocable.

Alternative considered: admin-only query parameter. That handles promoter self-preview but fails the stakeholder review use case.

### Store review-link metadata in a new table

Add a sidecar Supabase SQL migration for a table such as `public.show_review_links` with fields along these lines:

- `id uuid primary key`
- `show_id uuid not null references public.shows(id) on delete cascade`
- `promotion_id uuid references public.promotions(id) on delete set null`
- `token_hash text not null unique`
- `label text`
- `expires_at timestamptz not null`
- `revoked_at timestamptz`
- `created_by uuid references auth.users(id) on delete set null`
- `created_at timestamptz not null default now()`

Only admins should create, read management metadata, update, or revoke links under RLS. Token validation for public review access should not expose management metadata.

Rationale: expiration and revocation are explicit product requirements. Keeping the token hash in the database avoids storing raw bearer tokens at rest.

Alternative considered: encode all data in a signed URL token without a table. That is simpler to resolve but harder to revoke and inspect from the admin UI.

### Validate review tokens through a server route or RPC, not by exposing token hashes to the client

Use a server-side validation boundary for raw review tokens. A route such as `/api/show-review/validate` or an equivalent RPC can receive the raw token, hash it, check expiration/revocation, and return only the show/promotion identifiers and review eligibility needed by the UI.

Rationale: the raw token is a bearer credential. Client-side validation against public-readable token hashes would weaken the boundary.

Alternative considered: public RLS policy that selects by token hash directly from the browser. This avoids a route but makes token validation and metadata exposure harder to control.

### Represent review mode explicitly in URLs

Use a tokenized review URL that can enter the existing show route and carry review context, for example:

`/shows/<promotion>/<show>?review=<token>`

The lobby can validate the token and route to picks review mode:

`/picks?show=<show-id>&review=<token>`

If the implementation finds that query propagation is too brittle, a dedicated route such as `/review/<token>` is acceptable as long as it preserves the same behavior contract.

Rationale: this reuses the real lobby and picks surfaces, including friendly show URLs when available, while keeping the review context visible and easy to pass forward.

Alternative considered: a fully separate review page that duplicates lobby and picks UI. That would reduce risk to ordinary picks but likely duplicates a large amount of brownfield UI logic.

### Add a read-only review mode inside the picks flow

In review mode, the picks page should load the same configured show data but change step behavior:

- Do not require a `userId` to enter review mode when the token is valid.
- Do not load or hydrate an actual user's existing pick row for review mode.
- Do not write `picks`.
- Do not write normal draft or last-step local storage keys.
- Allow next/finish without requiring a selection.
- Any interactive selections are in-memory only.
- Label the surface as review/preview so it is not confused with a submitted entry.

Rationale: the current picks page already owns step ordering and match/special-section rendering. A mode flag is lower risk than recreating all show-item presentation elsewhere.

Alternative considered: disable every pick control and show only static cards. That is safer but does not let promoters verify the interaction flow.

### Keep normal player behavior untouched

Review mode should branch on a validated review context. Outside that context, the existing show lobby and picks behavior remain unchanged: auth is required, location gate applies, locks apply, saves upsert `picks`, drafts write to normal local storage keys, and scoreboards consume only real picks.

Rationale: existing submitted picks and scoreboard behavior are high-risk brownfield contracts.

## Risks / Trade-offs

- Raw token leakage grants review access until expiration or revocation -> use high-entropy tokens, store only hashes, default to a bounded expiration, and expose revoke controls.
- Server validation may require a new route or use of server-side Supabase access -> keep the route narrow, avoid broad service-role reads where possible, and verify non-admin callers receive only review eligibility data.
- Reusing the picks page risks accidental writes -> add explicit review-mode guards around `handleSave`, draft persistence, last-step persistence, local analytics, and any pick-row load/hydration.
- Review mode may drift from the real fan flow if it branches too much -> reuse existing display components and only branch where persistence, auth, location, and navigation semantics differ.
- Friendly URL work is still active -> implement review link generation against the current URL helper state and verify both UUID and friendly show routes if that change remains active.

## Migration Plan

1. Add sidecar SQL for `show_review_links`, indexes, and RLS.
2. Add server-side token creation/validation helpers or routes.
3. Add admin UI controls for creating, copying, opening, and revoking links.
4. Add review-context validation to show lobby and picks routes.
5. Add picks review-mode guards to prevent `picks` writes and normal local-storage writes.
6. Verify invalid, expired, and revoked links do not bypass normal player rules.

Rollback is primarily UI and route removal plus revoking existing review links. The table can remain safely unused if rollback is needed, since it should not affect ordinary fan or admin workflows.
