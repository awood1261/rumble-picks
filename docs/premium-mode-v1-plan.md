# Premium Mode V1 Plan

## Goal
Ship a playable premium mode that feels like a retro wrestling game while reusing the current data model, picks logic, save flow, and scoring system wherever possible.

The plan is to build a second presentation layer, not rewrite the standard app.

## Guiding Rules
- Reuse existing `stepItems`, picks payload, scoring, and save behavior.
- Keep standard mode untouched as much as possible.
- Build premium mode behind separate routes first.
- Use placeholder art and local mappings before building admin asset tooling.
- Keep the first version static and readable. No animation system and no sound.

## Phase 0: Product Decisions

### Purpose
Lock the decisions that affect architecture before writing UI code.

### Deliverables
- Decide premium mode entry point:
  - route-based first, recommended
  - per-user toggle later if needed
- Decide premium route structure
- Confirm map behavior:
  - free-select nodes in v1, recommended
- Confirm sprite state behavior:
  - neutral before selection
  - victory for selected winner side
  - defeat for losing side
- Confirm avatar creator scope:
  - skin tone
  - hair style
  - hair color
  - top
  - bottom
  - one accessory

### Exit Criteria
- Route strategy is decided
- Map behavior is decided
- Avatar field list is final for v1

## Phase 1: Data and Asset Foundations

### Purpose
Create the minimum schema and asset conventions needed for premium mode.

### Work
- Add wrestler sprite fields:
  - `sprite_neutral_url`
  - `sprite_victory_url`
  - `sprite_defeat_url`
- Add user avatar config storage:
  - `avatar_config jsonb`
- Decide whether show intro/title art is:
  - local mapping for prototype, recommended
  - DB-backed in later phase
- Define asset specs:
  - transparent PNGs
  - fixed canvas size
  - bottom-aligned subject framing
- Create placeholder assets:
  - fallback wrestler sprite
  - placeholder title card art
  - placeholder map node icons

### Suggested File/Schema Targets
- `supabase/schema.sql`
- profile/user table definitions where avatar config is stored
- `public/` premium asset directories
- optional local config files in `src/lib/`

### Exit Criteria
- Schema changes are defined
- Placeholder art exists
- Asset folder structure is in place

## Phase 2: Premium Route Shell

### Purpose
Create a safe premium entry point without touching the standard experience.

### Work
- Add a premium route for the show entry screen
- Add a premium route for the picks flow
- Reuse existing show lookup/loading
- Add a premium layout shell:
  - retro frame
  - typography
  - color system
  - shared premium panel styles

### Recommended Routes
- `/play/premium`
- `/picks/premium?show=...`

### Components To Create
- `PremiumShell`
- `PremiumPanel`
- `PremiumButton`
- `PremiumHeader`

### Exit Criteria
- Premium routes render
- Existing show data loads correctly
- Standard routes remain unchanged

## Phase 3: Show Intro Experience

### Purpose
Replace the normal show splash with a retro game-like intro flow.

### Work
- Build a quick splash screen
- Build an 8-bit title card
- Add a `Play` CTA
- Transition into the premium picks hub

### Components To Create
- `PremiumShowSplash`
- `PremiumTitleCard`

### Notes
- Keep this visually rich but structurally simple
- No need for audio or long transitions in v1

### Exit Criteria
- User can enter premium mode from a show and reach the picks hub

## Phase 4: Premium Picks Hub Map

### Purpose
Replace the wizard-like progression with a retro overworld/map interface.

### Work
- Use existing `stepItems` as the source for map nodes
- Render nodes for:
  - matches
  - questions
  - eliminators
  - events
- Show state for:
  - incomplete
  - selected/current
  - completed
- Allow the user to choose a node and open that pick screen
- Return to the map after a save

### Components To Create
- `PremiumPicksMap`
- `PremiumMapNode`
- `PremiumMapLegend`

### Notes
- Do not invent a new progression engine in v1
- Free-select nodes is simpler and fits the current data model better

### Exit Criteria
- A user can navigate the picks flow from the map instead of the current wizard footer

## Phase 5: Premium Match Scenes

### Purpose
Build the premium version of the prediction screens using wrestler sprites.

### Build Order
1. Singles
2. Tag matches
3. Triple threat / multi-person

### Work
- Build a ring/stage background
- Replace wrestler photos with sprites
- Support sprite states:
  - neutral
  - victory
  - defeat
- Reuse current winner selection behavior
- Preserve bonus picks logic
- Keep question and finish logic unchanged under the hood

### Components To Create
- `PremiumMatchScene`
- `PremiumSinglesScene`
- `PremiumTagScene`
- `PremiumMultiMatchScene`

### Notes
- Use placeholder sprites first
- Prioritize clarity of selection state over visual complexity
- Keep the UI performant on mobile

### Exit Criteria
- Users can make and save picks in premium mode using sprite-based match screens

## Phase 6: Premium Question Scene

### Purpose
Make non-match steps visually consistent with the premium mode.

### Work
- Build a retro-styled question card
- Reuse existing question data and save behavior
- Route question steps through the premium hub/map

### Components To Create
- `PremiumQuestionScene`

### Exit Criteria
- Questions work end-to-end in premium mode

## Phase 7: Character Creator

### Purpose
Replace the current avatar pick flow with a small, layered retro character builder.

### Work
- Build a layered avatar preview
- Add selectors for:
  - skin tone
  - hair style
  - hair color
  - top
  - bottom
  - accessory
- Save avatar config to the user profile

### Components To Create
- `PremiumAvatarBuilder`
- `PremiumAvatarPreview`
- `PremiumAvatarPartSelector`

### Notes
- Keep this deliberately small in v1
- Browser-rendered layered PNG parts are simpler than pre-rendering images

### Exit Criteria
- User can build and save a premium avatar config

## Phase 8: Premium Scoreboard

### Purpose
Show user identity in a way that matches premium mode.

### Work
- Render user avatars from `avatar_config`
- Reuse current score and rank data
- Build retro leaderboard rows/cards

### Components To Create
- `PremiumScoreboardCard`
- `PremiumAvatarBadge`

### Exit Criteria
- Premium scoreboard shows avatars and scores correctly

## Phase 9: Cleanup and Integration

### Purpose
Turn the prototype into something stable enough to iterate on.

### Work
- Add fallback behavior for missing wrestler sprite assets
- Add loading/skeleton states for premium screens
- Validate mobile layout
- Validate that premium and standard mode stay in sync on picks payload and scoring
- Add basic smoke tests for:
  - show entry
  - map navigation
  - match picks
  - question picks
  - scoreboard rendering

### Exit Criteria
- Premium mode is stable enough for internal testing

## Recommended First Milestone

### Milestone: Premium Prototype Alpha
- Premium route exists
- Premium show intro exists
- Premium picks map exists
- Premium singles match screen works
- Premium question screen works
- Existing save flow still works
- Placeholder art is acceptable for testing

This is the fastest version that proves the product idea without requiring the full character creator or scoreboard redesign.

## Recommended Build Order Summary
1. Product decisions
2. Schema and asset conventions
3. Premium route shell
4. Show intro
5. Map UI
6. Singles match scene
7. Tag match scene
8. Question scene
9. Character creator
10. Scoreboard

## Risks To Watch
- Sprite asset creation taking longer than UI code
- Overcomplicating the map beyond what `stepItems` already gives you
- Mixing premium and standard UI logic too deeply
- Letting character creation scope expand beyond the small v1 set
- Making the retro UI less readable than the current production flow

## Recommended Immediate Next Step
Start with the route shell and the premium map, not the character creator.

That gets visible progress fastest while preserving the existing backend and picks logic.
