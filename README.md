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
- Each player has **two hikers**, **one bottle**, **one campfire token**, and **two hidden bonus
  scoring cards**.
- On your turn you move **one hiker forward** any distance and take that site's action. Hikers
  never move backwards, and a turn always moves a hiker.
- **Every site except the trailhead starts each season with a sun or water token on it.** The
  first hiker to reach that site takes the token on top of the site's own payout. Fresh tokens go
  out every season.
- **Hikers cannot share a site.** The only way onto an occupied site is to spend a **campfire
  token** — everyone gets one at the start of each season, and there is no campfire location. The
  Trail Map gear waives the cost. Unspent campfires do not accumulate.
- Reaching the **Trail End** retires that hiker for the season and gives it exactly one action:
  visit a park, reserve a park, buy gear, take a photo, or rest for 1 sun.
- When every hiker is home the season ends: sun is discarded, bottles refill, campfires reset, and
  a longer trail is built with a fresh set of season tokens.

### Resources

| Resource | Use |
| --- | --- |
| ☀️ Sun | Gear, photos, and some park costs. **Does not carry between seasons.** |
| 💧 Water, 🌲 Tree, ⛰️ Mountain | Park costs. Carry over between seasons. |
| 🐾 Wildlife | **Not a cost of its own — a wildcard** that pays for any one resource. |
| 🔥 Campfire token | Spend to move onto a site another hiker occupies. One per player per season. |

### The camera

One camera exists in the game. A hiker stopping at a **Camera Point** either takes it — and may
immediately shoot for 1 sun — or leaves it and takes a **bottle** card instead.

- A photo costs **2 sun**, or **1 sun while you hold the camera** (the Tripod gear gives the same
  price without it).
- The next hiker to reach a Camera Point takes the camera off whoever is carrying it.
- Ending your trail lets you take another photo at the Trail End.

### Bottles

A bottle converts **1 water into something else, once per season**, at any point on your turn:
Sun Flask (1 water → 2 sun), Stone Flask (1 water → 1 mountain), Pine Flask (1 water → 1 tree).
They refill at the season break, and a **Spring** site refills one on the spot. Everyone starts
with one; more come from declining the camera.

### Prizes for being first

- The **first player to buy gear each season** pays 1 sun less.
- The **first player to reserve a park each season** takes the **first player token**: they lead
  the next season, and whoever holds it at the end of the game scores 1 VP.

### Scoring

- Park cards score their printed VP (3–6).
- Photos score 1 VP each, 2 VP with the Photo Album.
- The two hidden bonus cards score at game end.
- The first player token scores 1 VP.
- Leftover resources score 1 VP per 3.
- Ties break on most parks, then most photos.

### House rules and interpretations

- Sun is discarded at the end of each season; every other resource is kept.
- Leftover resources are worth 1 VP per 3 rather than nothing.
- Photos cost 2 sun at full price and 1 sun with the camera, so the camera is worth chasing.
- Gear is bought only at the Trail End, one card per hiker that arrives there.
- Two bonus scoring cards per player replace the published year-card bonuses.

## The CPU opponents

All three evaluate every legal move each turn and take the highest-value one, so they are
genuinely opportunistic: they take the site you left open and they price the turns they give
up by walking past sites.

| Opponent | Style |
| --- | --- |
| **Ranger Ada** | Banks resources, converts them into the highest-value parks in reach. |
| **Scout Bo** | Chases the camera, builds a photo and gear engine, then picks off cheap parks. |
| **Blazer Cy** | Tempo and denial: season tokens, the first player token, and the site you wanted. |

The evaluation function values each resource by what the currently reachable park cards need
(counting the season token still sitting on a site), then subtracts the opportunity cost of every
stop a move walks past — the season ends when both hikers are home, so a long stride is a spent
turn. A site someone is standing on counts as a partial future stop, since it usually clears
before the season ends. `src/dev/` holds the benchmarks that keep them
honest:

- `baseline.test.ts` plays them against a shortest-step bot that maximizes turns taken, and fails
  if the CPUs fall more than 8% behind it.
- `mirror.test.ts` plays each style against copies of itself and fails if the three drift more
  than 20% apart in strength.
- `selfplay.test.ts` checks the park deck stays deep enough for four seasons.

Current results (40 games each): the CPUs average 43–45 points against a shortest-step baseline
that lands around 42–44, and take about 33 stops a game to the baseline's 41.

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
