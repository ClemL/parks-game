# Trailside Seasons

A browser implementation of the *PARKS*-style hiking game: your hikers walk a trail collecting
resources, and spend them at the end of the trail to visit national parks — over four seasons.
One human seat, three CPU opponents.

Built with React + TypeScript + Vite. No backend, no accounts, no storage beyond a local art cache.

> Fan project. Not affiliated with, endorsed by, or licensed from Keymaster Games, who publish
> *PARKS*. The name, artwork, cards, and icon set here are original or drawn from public sources;
> only the core mechanics are modeled on the published game.

## Play locally

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # engine rules + CPU benchmarks
npm run build    # type-check and bundle to dist/
```

## Deploy to Vercel

The repo is Vercel-ready (`vercel.json` pins the Vite preset, `dist` output, and SPA rewrites).

**Git integration (recommended, no tokens needed):**

1. https://vercel.com/new → *Import Git Repository* → pick this repo.
2. Framework preset is detected as **Vite**; build `npm run build`, output `dist`.
3. Deploy. Every push to the branch then redeploys automatically.

**Or from a terminal:**

```bash
npm i -g vercel
vercel login
vercel --prod
```

There are no environment variables to set.

## Rules as implemented

### The hike

- **Four seasons.** Each season lays out a fresh trail one site longer than the last — 6 middle
  sites in spring up to 9 in winter, plus the trailhead and the Trail End.
- Each player has **two hikers** and starts with **one water bottle** and **two hidden bonus
  scoring cards**.
- On your turn you move **one hiker forward** any distance and take that site's action. Hikers
  never move backwards, and a turn always moves a hiker.
- **Hikers cannot share a site.** The only way onto an occupied site is to spend a **campfire
  token**, gained at Campfire sites (the Trail Map gear waives the cost). The trailhead and the
  Trail End hold everyone.
- Reaching the **Trail End** retires that hiker for the season. There it takes exactly one action:
  claim a park by paying its cost, take a photo for 1 sun, or rest for 1 sun.
- When every hiker is home the season ends: sun is discarded, canteens refill, the first-player
  marker passes, and a new trail is built.

### Resources

| Resource | Use |
| --- | --- |
| ☀️ Sun | Gear, photos, and some park costs. **Does not carry between seasons.** |
| 💧 Water, 🌲 Forest, ⛰️ Mountain, 🐾 Wildlife | Park costs. Carry over between seasons. |
| 🧴 Water bottle | One wild resource per season. Refills at a Spring site or at the season break. |
| 🔥 Campfire token | Spend to move onto a site another hiker occupies. |

### Scoring

- Park cards score their printed VP (3–6).
- Photos score 1 VP each, 2 VP with the Photo Album.
- The two hidden bonus cards score at game end.
- Leftover resources score 1 VP per 3.
- Ties break on most parks, then most photos.

### House rules and interpretations

The published game is the reference, but a few things are our own reading, chosen for a clean
single-player experience:

- Sun is discarded at the end of each season; every other resource is kept.
- Leftover resources are worth 1 VP per 3 rather than nothing.
- Campfires are tokens you collect and spend, rather than a site-sharing state.
- Gear is bought with sun at the start of your turn, one card per turn.
- Two bonus scoring cards per player replace the published year-card bonuses.

## The CPU opponents

All three evaluate every legal move each turn and take the highest-value one, so they are
genuinely opportunistic: they take the site you left open and they price the turns they give
up by walking past sites.

| Opponent | Style |
| --- | --- |
| **Ranger Ada** | Banks resources, converts them into the highest-value parks in reach. |
| **Scout Bo** | Builds a gear and photo engine first, then picks off cheap parks. |
| **Blazer Cy** | Tempo and denial: campfires, contested sites, and the site you wanted. |

The evaluation function values each resource by what the currently reachable park cards need,
then subtracts the opportunity cost of every stop a move walks past — the season ends when both
hikers are home, so a long stride is a spent turn. `src/dev/` holds the benchmarks that keep them
honest:

- `baseline.test.ts` plays them against a shortest-step bot that maximizes turns taken, and fails
  if the CPUs fall more than 8% behind it.
- `mirror.test.ts` plays each style against copies of itself and fails if the three drift more
  than 20% apart in strength.
- `selfplay.test.ts` checks the park deck stays deep enough for four seasons.

Current results (40 games each): the CPUs average 38–42 points and beat the shortest-step
baseline, which lands around 36–38.

## Park artwork

The English Wikipedia API is called once at load to resolve each park's lead photograph
(`prop=pageimages`, CORS-enabled), together with the artist and license from Wikimedia Commons.
The answer is cached in `localStorage` for 30 days and every image used is listed under
**Credits** in the app. Many of the photographs are works of the U.S. National Park Service and
are in the public domain; others carry the Creative Commons license shown in the credits table.

Any park whose photograph cannot be resolved — offline, blocked network, or an article with no
lead image — falls back to generated vector scenery keyed to that park's palette and terrain
tags, so the board is always complete.

## Project layout

```
src/game/        rules engine, data tables, scoring, CPU logic (pure TypeScript, no React)
src/game/engine.test.ts   rules tests
src/dev/         CPU strength benchmarks
src/components/  board, trail, player panels, modals
src/art/         Wikipedia art resolution and generated fallback artwork
src/hooks/       game state and the CPU turn driver
```

The engine is a pure reducer: `applyAction(state, action)` returns a new state, and the CPU and
the UI both drive it through the same action list, so a game is fully replayable from its seed.
