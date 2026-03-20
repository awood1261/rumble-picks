<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into BoutPick (rumble-picks). PostHog is initialized via `instrumentation-client.ts` (the recommended approach for Next.js 15.3+) with a reverse proxy through `/ingest` to improve event delivery reliability. User identification is performed on sign-in, sign-up (both email and anonymous flows), and session replay and error tracking are enabled via `capture_exceptions: true`.

Eight events were instrumented across four files, covering the full user lifecycle from registration through picks submission and profile management.

| Event | Description | File |
|---|---|---|
| `user_signed_in` | User successfully signed in with email and password | `src/app/login/page.tsx` |
| `user_signed_up` | User created a new email account | `src/app/login/page.tsx` |
| `user_signed_up_anonymous` | User created an anonymous profile (no email required) | `src/app/login/page.tsx` |
| `user_signed_out` | User signed out | `src/app/login/page.tsx` |
| `picks_saved` | User successfully saved their picks for a show | `src/app/picks/page.tsx` |
| `show_viewed` | User viewed a show detail page (top of picks funnel) | `src/app/shows/[promotionId]/[showId]/page.tsx` |
| `profile_updated` | User saved changes to their display name or avatar | `src/app/profile/page.tsx` |
| `account_upgraded` | Anonymous user linked an email address to their account | `src/app/profile/page.tsx` |

### Files created / modified

- **`instrumentation-client.ts`** — PostHog client-side initialization with reverse proxy, exception capture, and debug mode in development
- **`next.config.ts`** — Added `/ingest` reverse proxy rewrites and `skipTrailingSlashRedirect: true`
- **`.env.local`** — Added `NEXT_PUBLIC_POSTHOG_TOKEN` and `NEXT_PUBLIC_POSTHOG_HOST`
- **`src/app/login/page.tsx`** — Sign-in, sign-up (email + anonymous), sign-out events; `posthog.identify()` on auth; `posthog.reset()` on sign-out; `posthog.captureException()` on auth errors
- **`src/app/picks/page.tsx`** — `picks_saved` event after successful upsert
- **`src/app/shows/[promotionId]/[showId]/page.tsx`** — `show_viewed` event once show data loads
- **`src/app/profile/page.tsx`** — `profile_updated` and `account_upgraded` events

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- [Analytics basics dashboard](https://us.posthog.com/project/349694/dashboard/1382278)
- [Show → Picks conversion funnel](https://us.posthog.com/project/349694/insights/NfZML4q1)
- [New sign-ups per day](https://us.posthog.com/project/349694/insights/YRSGrDAj)
- [Picks saved per day](https://us.posthog.com/project/349694/insights/GhXKiGlN)
- [Sign-in vs sign-out trend](https://us.posthog.com/project/349694/insights/43Fl5KqE)

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
