## Why

The admin console currently renders the desktop left panel as normal content on mobile, consuming enough vertical space that promoters can lose context after selecting a section. Mobile admin navigation should make the active section obvious while keeping the primary workflow visible.

## What Changes

- Replace the mobile presentation of the left admin panel with a compact mobile navigation pattern.
- Keep desktop admin navigation/sidebar behavior intact.
- Keep promotion and show selection available on mobile without forcing the full left panel to appear before every admin view.
- Preserve the existing admin sections: Dashboard, Shows, Card Builder, Results, Scoreboard, and Advanced/More.
- Preserve existing admin data behavior, Supabase access patterns, RLS authorization, scoring, picks, and routing.
- Add browser verification focused on small mobile viewports and desktop regression.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `promoter-admin-console`: Mobile navigation and active-section visibility requirements for the existing admin console.

## Impact

- Affects `src/app/admin/page.tsx` UI structure and responsive Tailwind classes.
- May affect admin-only supporting components if the implementation extracts small presentational pieces from the existing page.
- Does not affect promotion scope, RLS/authorization rules, predictions, scoring, database schema, submitted picks, API routes, Supabase Edge Functions, or dependencies.
- Must preserve brownfield admin operations and current client-side Supabase/RLS data-access behavior.
