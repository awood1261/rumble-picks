# Premium Mode V1 TODO

## Scope
- [ ] Build premium mode as a separate presentation layer, not a rewrite of standard mode
- [ ] Keep existing picks payload, scoring, save flow, and step ordering as the source of truth
- [ ] Ship premium mode behind separate premium routes first

## Routes
- [ ] Add a premium show entry route
- [ ] Add a premium picks route
- [ ] Decide whether premium profile creation lives on its own route or inside the existing profile flow
- [ ] Decide whether premium scoreboard needs its own route or can reuse the existing scoreboard data with a different UI

## Premium Show Entry
- [ ] Build a short splash screen experience
- [ ] Build an 8-bit title card screen for the show
- [ ] Replace current CTA copy in premium mode with `Play`
- [ ] Decide how premium show intro exits into the picks flow

## Premium Picks Hub
- [ ] Build a retro map UI using existing `stepItems`
- [ ] Render each event, eliminator, question, and match as a map node
- [ ] Show completed vs incomplete node states
- [ ] Allow users to select a node to open that prediction step
- [ ] Decide whether all nodes are freely selectable in v1

## Premium Match Scenes
- [ ] Build a premium singles match scene
- [ ] Build a premium tag match scene
- [ ] Build a premium triple threat / multi-person scene
- [ ] Add a wrestling ring background for premium match scenes
- [ ] Replace wrestler photos with wrestler sprite assets
- [ ] Support three wrestler sprite states: neutral, victory, defeat
- [ ] Apply victory pose to selected winner side
- [ ] Apply defeat pose to losing side
- [ ] Keep neutral pose for unresolved/unselected states

## Premium Question Scene
- [ ] Build a retro-styled question screen
- [ ] Reuse existing show question data and answer selection logic
- [ ] Make sure premium question steps still save through the existing picks payload

## Character Creator
- [ ] Build a simple avatar creation system
- [ ] Support 5-6 skin tones
- [ ] Support a few hair styles
- [ ] Support a few hair colors
- [ ] Support a few top options
- [ ] Support a few bottom options
- [ ] Support one accessory slot
- [ ] Render avatar parts as layered sprite assets in the browser
- [ ] Save avatar configuration to the user profile

## Premium Scoreboard
- [ ] Render user 8-bit avatars on the scoreboard
- [ ] Reuse existing score and rank data
- [ ] Design a retro leaderboard card for users
- [ ] Decide whether wrestler/show theme styling should also apply to scoreboard rows

## Data Model
- [ ] Add wrestler sprite fields for neutral / victory / defeat poses
- [ ] Add a user `avatar_config` field
- [ ] Decide whether show-level premium title art needs a DB field in v1 or can be hardcoded/local
- [ ] Decide whether premium access is per-user, per-show, or route-based for v1

## Asset Pipeline
- [ ] Define a fixed asset spec for wrestler sprites
- [ ] Define a fixed asset spec for avatar part layers
- [ ] Create fallback placeholder sprite assets for wrestlers without premium art
- [ ] Organize premium assets into a predictable folder structure

## Architecture
- [ ] Create separate premium components rather than adding many conditionals to current components
- [ ] Reuse existing step ordering and picks state from the current picks flow
- [ ] Keep premium and standard modes sharing the same backend data and save behavior
- [ ] Avoid changing scoring logic for premium mode

## Prototype Milestone
- [ ] Create one premium route for one show
- [ ] Build the premium map shell
- [ ] Build one premium singles match scene
- [ ] Build one premium tag match scene
- [ ] Build one premium question scene
- [ ] Use temporary placeholder sprite assets before final art exists

## Out of Scope For V1
- [ ] No sound/music
- [ ] No animated wrestler sprites
- [ ] No admin upload tools for premium assets yet
- [ ] No custom map editor
- [ ] No advanced character customization beyond the defined small set
