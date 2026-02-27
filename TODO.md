# TODO

- Add a database-level username profanity constraint (trigger or check) to prevent bypassing the client-side filter.

## Egress Reduction
- Pause polling when the tab is not visible (visibilitychange) for picks and scoreboard pages.
- Throttle polling intervals for high-traffic pages (public picks 60s, personal picks 30–60s).
- Split static vs live data and only refresh live portions on polling cycles.
- Minimize Supabase `select` columns in polling calls.
- Improve image caching (CDN/cache headers) to avoid repeated image egress.

## Deployment Guardrails
- Add a local pre-deploy typecheck step (ex: `npm run build` or `npx tsc --noEmit`) before pushing to Vercel.
