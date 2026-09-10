## Why

Promoters need to preview and share a show review experience before launch without creating fake picks, triggering geolocation checks, or affecting scores. This also supports sending a review link to a promotion stakeholder who is not an admin but needs to approve the fan-facing lobby and pick flow.

## What Changes

- Add admin-created, tokenized show review links that can be copied, shared, expired, and revoked.
- Add a non-persistent show review mode that shows the real show lobby and lets reviewers step through the configured show flow without saving picks.
- Allow valid review links to bypass show geolocation gates only for review mode.
- Add an admin preview action that opens the selected show in review mode without requiring promoters to create real picks.
- Preserve normal player behavior: ordinary show links, geolocation gates, authentication, submitted picks, scoring, scoreboard, and championship behavior remain unchanged.
- Add database support for review-link metadata and token validation.

## Capabilities

### New Capabilities

- `show-review-links`: Admin-created share links and token validation for non-persistent show review mode.

### Modified Capabilities

- `promoter-admin-console`: Admins can create, copy, revoke, and open show review links from the admin console.
- `show-lobby`: A valid review context can view the show lobby and continue to review mode without location verification.
- `picks`: Review mode can step through configured prediction surfaces without creating or updating picks, drafts, scores, or scoreboard data.

## Impact

- Affects promotion scope because review links resolve to a specific show and its promotion.
- Affects RLS/authorization because only admins may create or revoke review links, while valid token holders may read the limited review experience.
- Affects prediction entry UX but not the canonical submitted-pick model or `picks.payload` shape.
- Does not change scoring source of truth, scoreboard calculations, championship behavior, or existing submitted picks.
- Requires a database migration for review-link metadata, token uniqueness, expiration, and revocation.
- No Supabase Edge Functions are expected. If server-side token hashing or service-role behavior is introduced during implementation, it must be explicitly scoped and justified.
- Coordinates with the active `add-friendly-show-urls` change: friendly public show URLs should remain preferred for normal fan links, while review links must still resolve to internal `show_id`.
