## Context

See `proposal.md` for motivation. The current admin console is a large client route in `src/app/admin/page.tsx`. It renders a desktop-style left panel containing promotion selection, section navigation, and admin identity before the main content. The same panel currently appears in normal document flow on mobile, while a separate horizontal mobile section row also exists inside the main header.

The implementation should preserve the existing single-page admin state model: `adminView`, selected show, active promotion, readiness, and existing handlers remain the source of behavior.

## Goals / Non-Goals

**Goals:**

- Remove the desktop left panel from the mobile content flow.
- Keep mobile promoters oriented with a compact current promotion/show summary.
- Provide obvious mobile navigation between admin sections without requiring scroll-back-to-top after every selection.
- Preserve the desktop sidebar and current admin data behavior.

**Non-Goals:**

- Do not redesign the admin workflows themselves.
- Do not change Supabase queries, RLS policies, schema, scoring, picks, or result persistence.
- Do not introduce route-per-section navigation, new dependencies, server actions, API routes, or Edge Functions.
- Do not solve deeper mobile layout issues inside each admin section beyond navigation/context visibility.

## Decisions

### Use responsive presentation, not new routes

Keep the admin console as a single client route with the existing `adminView` state. The mobile navigation should call the same `setAdminView` behavior as the current desktop buttons.

Rationale: the current admin page is stateful and brownfield. Route-per-section navigation would broaden scope and risk changing selected-show behavior.

Alternative considered: introduce `/admin/results`, `/admin/card`, etc. This would improve URL addressability but is a separate architecture change.

### Hide the desktop aside below `lg`

Render the left panel only for desktop-sized viewports. Mobile should not display that panel above the selected section.

Rationale: the reported problem is vertical space consumed by the left panel. Keeping it mounted visibly on mobile preserves the problem.

Alternative considered: collapse the sidebar into a shorter inline card. This still spends vertical space before every section and duplicates the existing header controls.

### Keep compact mobile context near the top

Mobile should retain a compact current promotion/show context and the existing current-show selector, but the presentation should be denser than the desktop sidebar. It may live in the header area or a compact disclosure.

Rationale: promoters need confidence they are editing the right show. Removing all context would make admin changes riskier.

Alternative considered: move promotion/show selection entirely into a drawer. This saves space but hides important editing context.

### Use persistent mobile section navigation

Use a mobile-only section navigator that remains easy to reach and keeps the active section visually marked. A bottom nav is preferred if it can be implemented without covering form controls; otherwise a sticky compact tab row is acceptable.

Rationale: the user should be able to tell the selected admin page immediately after choosing it. Persistent navigation avoids forcing a long scroll back to switch tasks.

Alternative considered: hamburger menu only. It maximizes content area, but section state is less visible and switching is slower for repeated show-management work.

## Risks / Trade-offs

- Fixed bottom navigation can cover controls near the bottom of mobile forms -> Add appropriate mobile bottom padding to the main content if bottom navigation is used.
- A sticky tab row can feel cramped with six destinations -> Use shorter mobile labels such as Dashboard, Shows, Card, Results, Scores, More.
- Duplicated desktop/mobile navigation arrays can drift -> Reuse the same view list or keep labels close together in the same render area.
- Hiding the sidebar on mobile could hide promotion selection -> Keep current promotion/show controls visible in compact mobile context.
- Existing admin page is large and dense -> Keep implementation localized to shell/header/navigation structure and avoid refactoring domain logic.

## Migration Plan

No database or data migration is required. Deploy as a UI-only responsive layout change. Rollback is restoring the current mobile rendering of the existing sidebar and horizontal tab row.
