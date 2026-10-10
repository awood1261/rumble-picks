## Context

The current admin console is a large client route in `src/app/admin/page.tsx`. It keeps active promotion, active show, and active admin tool in local React state. Show creation now creates a draft show and immediately routes to Card Builder. Card Builder, public picks, public show pages, scoreboards, and scoring all read real `matches` records by `show_id`.

That makes actual placeholder match records risky: unless every public and scoring query is filtered correctly, unconfigured placeholders could leak into fan prediction UI, public show cards, results entry, or scoreboard calculations.

## Goals / Non-Goals

**Goals:**
- Keep the primary Create Show form focused on essential show setup.
- Add an optional post-create card setup prompt with planned match count.
- Represent planned match count as show-level planning metadata, not real matches.
- Render planned slots as virtual admin-only rows in Card Builder.
- Preserve all fan-facing, picks, scoring, and scoreboard behavior for real records.
- Make Promotion -> Current Show -> Tool context explicit and durable enough to survive refresh/deep links.

**Non-Goals:**
- Do not introduce a separate match-slot table in the first version.
- Do not create real placeholder `matches` rows solely to represent unconfigured planned slots.
- Do not normalize legacy event-level picks or legacy event-level scoring.
- Do not make planned match count an enforced limit.
- Do not redesign the entire admin console outside the create-show/card-builder/context surfaces needed for this change.

## Decisions

### Store planned match count on `shows`

Add nullable `shows.planned_match_count`.

Rationale:
- Existing shows can remain `null` without migration.
- The value is promoter intent and belongs to the show.
- A single count supports the desired UX without introducing another table.
- Existing promotion-scoped show update RLS can protect changes.

Suggested SQL sidecar:

```sql
alter table public.shows
  add column if not exists planned_match_count integer;

alter table public.shows
  drop constraint if exists shows_planned_match_count_chk;

alter table public.shows
  add constraint shows_planned_match_count_chk
  check (
    planned_match_count is null
    or planned_match_count between 0 and 100
  );
```

Alternative considered: `show_match_slots` table. This would support per-slot metadata before a match exists, but it adds lifecycle, ordering, deletion, and visibility complexity that the first version does not need.

Alternative considered: placeholder rows in `matches`. This fits the ordered-card model but is too risky because public and scoring flows already load matches by `show_id`.

### Render planned slots virtually

Card Builder should derive planned slots from:

```text
plannedTotal = activeShow.planned_match_count
realMatches = orderedShowMatches
virtualSlotCount = max(plannedTotal - realMatches.length, 0)
```

Virtual slots are UI objects only. They should not have database ids and should not be passed into existing fan-facing, scoring, results, or picks arrays.

When an admin opens a virtual slot:
- Pre-fill the match creation surface with an intended `order_index`.
- Create `matches` and `match_sides` only when the admin saves.
- Preserve existing match creation behavior after save.

If real match count exceeds planned count, display every real match and use language that does not imply an error. The UI can offer an explicit way to update the planned count later, but exceeding the count must not block workflows.

### Replace readiness percentage in Card Builder with configuration status

Use match-level configuration checks instead of show-completion claims.

Suggested match setup status:
- `not_configured`: virtual slot or real match with no meaningful setup.
- `needs_attention`: real match is missing data needed for fan picks.
- `configured`: real match has enough data for fan picks.
- `resulted`: real match has result data.

Initial configuration checks should reuse existing signals:
- Normal match has sides.
- Each side has at least one participant.
- Blind gauntlet has known wrestler and candidate setup as currently required.
- Optional presentational gaps remain warnings, not blockers.

For shows with planned count:

```text
0 of 6 matches configured
2 matches need attention
```

For shows without planned count:

```text
No matches added yet
All added matches are configured
2 matches need attention
```

Do not display `100% Ready` as a show-level claim in Card Builder.

### Add post-create prompt as a transient admin state

After `handleCreateShow` succeeds, do not immediately switch straight to `card`. Instead:
- Store the created show as selected.
- Show a "Show created!" confirmation.
- Ask "Set up your card?"
- If the admin sets a count, update `shows.planned_match_count` and continue to Card Builder.
- If the admin skips, continue to Card Builder with `planned_match_count = null`.

This can be modeled as an admin view such as `post-create-card-setup` or a sub-state of the existing create-show flow. A distinct admin view is clearer because the show already exists at this point.

### Use URL query params as the first durable context layer

Prefer query-backed context before introducing nested admin routes:

```text
/admin?promotion=<promotion-id-or-slug>&show=<show-id-or-slug>&tool=card
```

Rationale:
- Lower-risk fit for the current single admin route.
- Preserves refresh and shareable admin links.
- Avoids a large route migration before the UX is validated.

The local React state can remain as the working state, but should synchronize with URL params:
- On load, resolve manageable promotion.
- Resolve selected show only if it belongs to selected promotion.
- If invalid, clear or choose the next valid show in that promotion.
- Update URL when admin switches promotion, show, or tool.

Future route structure can still evolve later if needed.

### Keep authorization boundaries in the database and existing server checks

All planned count writes should use the current Supabase client under RLS, protected by existing scoped show update policies. No new service-key path should be needed.

The UI must still treat client checks as UX only. If implementation discovers RLS does not cover planned count updates for assigned promotion members, update the SQL sidecar and document it.

## Risks / Trade-offs

- [Risk] `planned_match_count` is too simple if promoters later want named slot placeholders or pre-planned match types. -> Mitigation: defer `show_match_slots` until that product need exists; do not block the first version.
- [Risk] URL synchronization can fight existing local state effects that auto-select the first active show. -> Mitigation: centralize selected promotion/show/tool resolution and ensure promotion mismatch always clears invalid show state.
- [Risk] Existing readiness UI may still appear outside Card Builder. -> Mitigation: scope this change to Card Builder and context surfaces first; avoid broad dashboard/show-page refactors unless needed to remove misleading post-create guidance.
- [Risk] Virtual slots could accidentally be mixed into arrays used by picks or scoring. -> Mitigation: keep virtual slots in Card Builder-only derived UI structures and never store them in shared match arrays.
- [Risk] Existing lint failures can obscure regressions. -> Mitigation: run `npx tsc --noEmit --pretty false`, `npm run build` where possible, and document known lint failures separately.

## Migration Plan

1. Add SQL sidecar for `shows.planned_match_count`.
2. Run the SQL in Supabase before relying on the field in the deployed app.
3. Update TypeScript row types and Supabase show select lists to include `planned_match_count` only where needed.
4. Deploy admin UI changes after the schema is present.
5. Existing shows remain compatible because `planned_match_count` defaults to `null`.

Rollback:
- UI rollback is safe because existing real matches remain unchanged.
- The nullable column can remain unused if code is rolled back.
- If needed, clear `planned_match_count` values without affecting matches, picks, results, or scores.

## Future Considerations

- The first version treats planned match count as normal matches only, not rumbles, eliminators, or show questions.
- A future change may decide whether Dashboard and Shows should also replace readiness percentage globally. This change focuses on the create-show to Card Builder workflow and show-specific admin context.
