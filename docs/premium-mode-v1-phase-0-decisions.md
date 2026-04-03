# Premium Mode V1 Phase 0 Decisions

## Purpose
These decisions convert the Phase 0 planning work into concrete implementation choices for this codebase.

The goal is to reduce ambiguity before building any premium-mode UI.

## 1. Activation Strategy

### Decision
Premium mode will launch as a separate route-based experience.

### Why
- Lowest risk to the current production flow
- No need to immediately thread a theme toggle through the entire app
- Easier to prototype, test, and iterate without destabilizing standard mode

### Implementation Decision
Use separate premium routes first:
- `/play/premium`
- `/picks/premium`

Optional later additions:
- `/scoreboard/premium`
- `/profile/premium`

### Non-Goal For V1
- No per-user premium entitlement logic yet
- No premium subscription gating yet
- No show-level premium routing override yet

## 2. Route Structure

### Decision
Premium mode will be introduced as new route trees, not conditional rendering inside existing pages.

### Implementation Decision
Add these first:
- `src/app/play/premium/page.tsx`
- `src/app/picks/premium/page.tsx`

Likely later:
- `src/app/profile/premium/page.tsx`
- `src/app/scoreboard/premium/page.tsx`

### Shared Logic Rule
Premium routes should reuse the same data loading and picks persistence behavior as the standard routes whenever possible.

That means:
- same Supabase data
- same picks payload
- same scoring
- same show/match/question IDs

## 3. Navigation Model

### Decision
Premium picks will use a free-select retro map built from the existing step model.

### Why
- Best fit for the existing `stepItems` structure
- Easier than inventing an unlock/progression system
- Better for users during live shows when they may want to jump between open picks

### Implementation Decision
Use existing step metadata as the source of truth:
- `event`
- `eliminator`
- `question`
- `match`

Each step becomes one map node.

### Node States
Each node should support:
- `unanswered`
- `active`
- `answered`

Optional later:
- `locked`
- `resolved`

### Interaction Model
- User lands on premium map first
- Clicking a node opens that prediction screen
- Saving returns the user to the map
- Map reflects completion state after save

### Non-Goal For V1
- No branching level/unlock system
- No custom map editor
- No alternate map layouts per show

## 4. Premium Match Interaction Rules

### Decision
Premium match screens will keep the current prediction rules and only change presentation.

### Sprite State Rules
- Before selection: all wrestlers show neutral sprite
- After winner selection:
  - selected side shows victory sprites
  - losing side shows defeat sprites
- If selection is cleared later, reset to neutral

### Tag Match Rule
For tag teams:
- all wrestlers on the selected side use victory pose
- all wrestlers on the non-selected side use defeat pose

### Triple Threat / Multi-Side Rule
- selected side/wrestler uses victory pose
- all other visible sides use defeat pose

### Non-Goal For V1
- No animation system
- No attack/hit reactions
- No sprite motion or transitions beyond simple UI state changes

## 5. Character Creator Scope

### Decision
Character creation will be a small layered avatar system rendered in the browser.

### Avatar Fields For V1
- `skinTone`
- `hairStyle`
- `hairColor`
- `topStyle`
- `topColor`
- `bottomStyle`
- `bottomColor`
- `accessory`

### Implementation Decision
Store avatar appearance as a JSON object rather than a pre-rendered image URL.

Suggested shape:

```json
{
  "skinTone": "tone_3",
  "hairStyle": "short_1",
  "hairColor": "brown",
  "topStyle": "tee_1",
  "topColor": "red",
  "bottomStyle": "pants_1",
  "bottomColor": "black",
  "accessory": "glasses"
}
```

### Why
- Easier to edit later
- No server-side image generation pipeline
- Works well with layered transparent PNG parts

### Non-Goal For V1
- No body sliders
- No multiple accessories
- No animation system for user avatars

## 6. Avatar Storage Location

### Decision
Store premium avatar configuration on the user profile record.

### Implementation Decision
Add:
- `avatar_config jsonb`

to the profile/user table currently used for avatar/identity data.

If the current profile table already stores avatar-related fields, place `avatar_config` there rather than creating a separate premium table.

### Why
- Keeps user identity in one place
- Simplifies scoreboard rendering
- Avoids additional joins for the v1 implementation

## 7. Wrestler Sprite Data

### Decision
Each wrestler will support three static sprite states.

### Implementation Decision
Add these fields to wrestler/entrant data:
- `sprite_neutral_url`
- `sprite_victory_url`
- `sprite_defeat_url`

### Fallback Rule
If a wrestler does not have sprite assets:
- render a premium fallback silhouette sprite
- do not fall back to real-life photos inside premium mode

### Why
The premium mode should stay visually consistent even when asset coverage is incomplete.

## 8. Show Intro Art Strategy

### Decision
Use local/static title-card art mappings for the first premium prototype instead of adding admin tooling immediately.

### Implementation Decision
For v1 prototype:
- store premium show art in the repo or public asset directory
- map it by show ID or slug in a local config file

Possible later DB field:
- `premium_title_art_url`

### Why
- Faster to prototype
- Avoids blocking on admin asset management
- Keeps Phase 1 and Phase 2 smaller

## 9. Scoreboard Representation

### Decision
Premium scoreboard will render user-created avatar sprites, not full-body animated characters.

### Implementation Decision
Use a compact avatar presentation:
- bust or standing sprite rendered from `avatar_config`

Keep the scoreboard data model unchanged:
- rank
- score
- username/display name

### Why
- Lower implementation complexity
- Cleaner fit for leaderboard rows
- Easier mobile layout

## 10. Asset Pipeline Rules

### Decision
Use layered PNG assets with fixed dimensions and consistent alignment.

### Rules
- transparent PNGs only
- fixed canvas size per asset type
- bottom-aligned framing
- same anchor point for neutral/victory/defeat wrestler poses
- same canvas dimensions for avatar layers

### Suggested Asset Groups
- wrestler neutral sprites
- wrestler victory sprites
- wrestler defeat sprites
- avatar skin layers
- avatar hair layers
- avatar tops
- avatar bottoms
- avatar accessory layer
- map node icons
- title-card art

## 11. Accessibility and UX Rule

### Decision
Premium mode must preserve the same functional clarity as standard mode.

### Requirements
- readable labels
- clear selected/unselected state
- mobile usability
- touch-friendly targets
- no reliance on animation to communicate state

### Non-Goal For V1
- visual complexity should not override usability

## 12. Immediate Build Starting Point

### First Concrete Milestone
Build this first:
- premium route shell
- premium show intro
- premium map using `stepItems`
- one premium singles match scene
- one premium question scene

### Why
This proves the premium concept quickly while avoiding early complexity from:
- tag layout edge cases
- character creator
- scoreboard redesign

## Summary Of Final Phase 0 Decisions
- Premium mode is route-based first
- Premium picks use a free-select map built from `stepItems`
- Character creator is a small layered browser-rendered avatar system
- Avatar data is stored as `avatar_config jsonb` on the profile/user record
- Wrestlers get three static sprite URLs
- Missing wrestler art falls back to a premium silhouette sprite
- Show intro art is locally mapped for the first prototype
- Scoreboard uses compact avatar rendering with existing score data
