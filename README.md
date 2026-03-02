# BoutPick (rumble-picks)

BoutPick is a fan prediction platform for pro-wrestling shows. It lets fans create a profile, make picks for matches, rumbles, and eliminators, then see live standings as results are entered.

## What it does

- **Shows**: Each show has a splash page, lock countdown, and a list of matches/events/eliminators in show order.
- **Picks flow**: Fans step through each item, select winners and bonus picks, and can return to edit before the show locks.
- **Eliminators**: Multi-entrant matches where users pick entry order, elimination order/type, and the winner.
- **Scoring**: Points are calculated per pick type and roll up into a show scoreboard.
- **Public picks**: Anyone can view a user’s picks and results.
- **Admin tools**: Create shows, matches, events, and eliminators; set order; enter results; recalculate scores.

## Stack

- **Frontend**: Next.js (App Router), React, Tailwind CSS
- **Backend**: Supabase (Postgres + Auth + Storage)

## Local development

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Configuration

Set Supabase env vars for local and deploy environments:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

## Notes

Image assets for shows, promotions, belts, and entrants live in Supabase Storage and are served via the app UI.
