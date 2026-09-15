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

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FClemL%2Fparks-game)

One click on the button above, or:

1. https://vercel.com/new → *Import Git Repository* → pick this repo.
2. The preset is detected as **Vite**; build `npm run build`, output `dist`.
3. Deploy. Every push then redeploys automatically.

Or from a terminal: `npm i -g vercel && vercel login && vercel --prod`.

There are no environment variables to set. `vercel.json` pins the Vite preset, the `dist` output
and the SPA rewrites.

## Playing

- **2 to 5 seats** — you plus one to four CPU hikers, chosen in the top bar and applied on the next
  new game. The Waterfall site joins the trail at four or more players, and a second early-buyer
  gear discount opens up, both as published.
- **Your game is saved** to the browser after every action, so a refresh or a closed tab picks up
  where you left off. Finishing a game clears the save.
- **Undo** steps back to just before your last move, CPU replies included.
- CPU moves flash the site they took, so their turns are readable without reading the log.
- Modals take keyboard focus when they open, hand it back when they close, and dismiss on Escape.
- **Your kit sits across the top** — resources, the token count, campfires, photos, bottles and
  gear on one line, with the bottles usable straight from there. Your own panel keeps the parks,
  reservations and bonus cards.
- **The season sits with the turn indicator**, above the trail rather than in the top bar.
- **The trail log closes the board**, below every player panel.
- **Compact density stands the hikers on the trail cards** rather than in a row beneath them,
  which halves the height of the trail strip (216px to 106px on a desktop).
- **Every section folds away** — tap its heading. A folded section keeps a one-line summary (which
  campsites are out, what the gear shop is selling, the last log line), and each player folds to
  their resource chips plus a one-liner. What you fold is remembered.
- **The notices close** — the turn hint, the season card and the resume banner each have an X. The
  hint has a switch in Setup to bring it back; a closed season card returns when the next season
  deals its own.
- **On a phone** the board opens with the campsites, gear shop, trail log and CPU seats already
  folded, and the setup controls tucked behind a **Setup** button. That is about a third less
  scrolling than the fully open board, before you fold anything yourself.

## Skins and layout

Six choices in **Setup → Skin**, all driven by CSS custom properties — a skin is a block of tokens,
nothing more. Every measured text/background pair passes WCAG AA.

| Skin | Look |
| --- | --- |
| **Auto** | Follows the device's light/dark setting, and keeps following it if you change it |
| **Trailside** (default) | Deep forest ground, parchment cards, gold accents |
| **Parchment** | A daylight board: the whole page becomes the same paper the cards are printed on |
| **WPA Poster** | The 1930s Park Service silkscreen palette — burnt orange, mustard, teal, cream, flat shadows |
| **Nightfall** | Indigo and violet after dark, named for the expansion |
| **High contrast** | Black on white with 2px rules, and the Okabe–Ito seat colours so the table never depends on telling red from green |

Two more controls sit beside it:

- **Density** — comfortable or compact, trading the space savings back for bigger type.
- **Season tint** — the board's highlight colour follows the season (spring green → summer gold →
  autumn rust → winter slate). The high-contrast skin ignores it on purpose.

Seat colours come from the skin rather than the game code, which is why the high-contrast skin can
swap in a colour-blind-safe set.

## On a phone

- **Tap anything to read its rules.** Hover text does not exist on a phone, so a tap on a trail
  site you cannot move to, a park card, a gear card, a campsite, a resource chip or a bottle opens
  a sheet with what it does — the season token waiting on it, who is standing there, what a
  wildcard pays for.
- **Decisions rise from the bottom edge** as sheets rather than centred boxes, so the buttons land
  under your thumb.
- **A pinned action bar** keeps the turn indicator, a jump-to-trail button and Undo in reach.
- **The trail scrolls to your next legal move** and its tiles snap as you swipe.
- **Installable and offline** — a manifest, icons and a service worker that caches the shell and
  the art as it is fetched. Run `npm run art` first and the whole game works with no network.
- Smaller things: the screen stays awake while the CPUs play, a short buzz when the table comes
  back to you, safe-area padding under the action bar and sheets, and taps that fire immediately
  instead of waiting to see if you meant to double-tap-zoom.

## Rules as implemented

Checked against the published PARKS rules (see **Fidelity notes** below for the
deliberate differences).

### The hike

- **Four seasons.** Each season's trail holds **one of every basic site** plus **one advanced site
  per season**, shuffled — 7 sites in spring growing to 10 in winter, so all four advanced sites are
  in play by the last season.
- Each player has **two hikers**, **one bottle**, **one campfire token**, and **two hidden bonus
  scoring cards**.
- On your turn you move **one hiker forward** any distance and take that site's action. Hikers
  never move backwards, and a turn always moves a hiker.
- **Every site except the trailhead starts each season with a sun or water token on it.** The
  first hiker to reach that site takes the token on top of the site's own payout.
- **Hikers cannot share a site.** The only way onto an occupied site is to spend a **campfire
  token**; the Trail Map gear waives the cost. Your campfire **re-lights when your first hiker
  reaches the Trail End**, so a well-timed season holds two shared sites.
- Reaching the **Trail End** retires that hiker and gives it one action: visit a park, reserve a
  park, buy gear, take a photo, or rest for 1 sun.
- A season ends when every hiker is home. Resources carry over; **nobody may end a turn holding
  more than 12 tokens**, and the overflow is returned (sun first, wildcards last).

### Sites

| Basic site | Action |
| --- | --- |
| Woodland | Gain 1 tree |
| Ridge | Gain 1 mountain |
| Valley | Gain 2 water |
| Sunlit Basin | Gain 2 sun |
| Waterfall | Gain 1 water and 1 sun |
| Camera Point | Take the camera (and a photo for 1 sun) or leave it and take a bottle |

| Advanced site | Action | Joins |
| --- | --- | --- |
| Wildlife Hide | Trade 1 resource for a wildcard | one per season, in a random order |
| Trading Post | Trade a resource for a different one, up to twice | |
| Ranger Station | Visit a park, reserve a park, or buy gear — mid-trail | |
| Overlook | Pay 1 water to copy the action of any site holding a hiker | |

### Resources

| Resource | Use |
| --- | --- |
| ☀️ Sun | Gear and photos only — no park asks for it |
| 💧 Water, 🌲 Tree, ⛰️ Mountain | Park costs; water also feeds bottles and the Overlook |
| 🐾 Wildcard | Pays for any resource, including part of a photo. No park asks for it by name |
| 🔥 Campfire token | Spend to share an occupied site. One per season, re-lit when your first hiker finishes |

### The camera

One camera exists in the game. A hiker at a **Camera Point** either takes it — and may immediately
shoot for 1 sun — or leaves it and takes a **bottle** card.

- A photo costs **2 sun**, or **1 sun while you hold the camera** (the Tripod gear gives the same
  price without it). Wildcards can cover part of the price.
- The next hiker to reach a Camera Point takes the camera off whoever is carrying it.

### Bottles

A bottle converts **1 water into something else, once per season**: Sun Flask (→ 2 sun), Stone
Flask (→ 1 mountain), Pine Flask (→ 1 tree). They refill at the season break. Everyone starts with
one; more come from declining the camera.

### Prizes for being first

- The **first two players to buy gear each season** pay 1 sun less (two discounts at 4–5 players,
  one at 3 or fewer).
- The **first player to reserve a park each season** takes the **first player token**: they lead
  the next season and score 1 VP at the end of the game.

### Scoring

- Park cards cost 2–7 resources (water, trees, mountain) and score 2–5 VP.
- Photos score 1 VP each, 2 VP with the Photo Album.
- **Each gear card scores 2 VP**, so building an engine competes with claiming another park.
- The two hidden bonus cards score at game end.
- The first player token scores 1 VP.
- Leftover resources score 1 VP per 3.
- Ties break on most parks, then most photos.

## Fidelity notes

Where this build knowingly differs from the published game, and why:

| Published rule | Here | Why |
| --- | --- | --- |
| No tokens sit on trail sites | Every site holds a sun or water token for the first hiker there | Requested house rule |
| Vista: draw a canteen **or** take a photo | Camera Point: take the camera (+ optional photo) **or** take a bottle | Requested house rule; the camera moves on a site visit rather than on taking a photo |
| Photo costs any 2 tokens, 1 with the camera | 2 sun, 1 with the camera, wildcards may substitute | Requested (sun-priced) |
| Campfire is a token you flip, once per season | Same, as a counted token | Equivalent |
| First hiker to the Trail End takes the first player marker | First player to **reserve** a park takes it | Requested house rule |
| Each player drafts 1 of 2 dealt Year cards | Each player keeps **two** bonus cards, both scoring | Requested house rule |
| A canteen is filled with water **gained that turn** | A bottle spends any water on your turn | Simpler to play solo; same once-per-season limit |
| Leftover resources score nothing | 1 VP per 3 | House rule, kept from the first build |
| Park costs include sun | Park costs are water, trees and mountain only | Sun had three uses and gear lost every contest; now sun means gear and photos |
| Gear scores no points | Each gear card scores 2 VP | Without it the CPUs bought 0.6 gear cards a game out of 13 |
| Three park cards face up | Four when either expansion is on | The expansions add so many park actions that a three-card row churns |
| 2nd edition: 3 seasons, fixed trail length | 4 seasons, growing trail (1st edition) | Matches the original request |

Scores here run higher than a published game of PARKS (CPUs average 50–55 rather than 30–40),
because the season tokens add roughly one extra resource per stop. Everything else — claim
opportunities, the token cap, cost bands — follows the rulebook.

## Expansions

Both published PARKS expansions are implemented and can be switched on or off in the top bar; the
choice applies to the next new game. Both are on by default.

### Nightfall

- Everyone starts with a **wildcard** token.
- A wildcard **covers two resources** when paying a cost, instead of one.
- **Tents** sit on the site before the Trail End and on every other site back toward the trailhead.
  A hiker landing on a tent site may take that site's action **or** camp at one of the three
  campsites — camping skips the site's action and its season token.
- Each campsite holds two tents at four or five players, one below that, and they empty at the
  season break.
- Ten more park cards.

| Campsite | Action |
| --- | --- |
| Stargazing Point | Gain a star: 1 wildcard |
| Nightfall Camp | Trade any 1 resource for a wildcard |
| Forest Clearing | Take 2 bottle cards |
| Alpine Bivouac | Turn in 1 mountain for 5 sun |
| Riverside Camp | Take a bottle card and 2 water |
| Outfitter Camp | Pay 2 sun to replace the gear row, then take a gear card free |

Three of the six are in play each game.

### Wildlife

- A **bison** stands on one park in the row. Visiting that park lets you trade a resource for a
  wildcard, then the bison moves one park right; when it loops back to the left it refreshes a gear
  card.
- **Four more advanced sites** join the pool. Season 1 always uses the Ranger Station and only
  three of the remaining seven are drawn per game, so no two games offer the same powers.
- Extra season cards — including the **Season of Chance**, which lets a park action claim the unseen
  top card of the park deck — and eight more park cards.

| Wildlife site | Action | Source |
| --- | --- | --- |
| Memory Cliffs | Give up a photo to gain 1 of each resource | published |
| Bison Meadow | Trade 1 resource for a wildcard, then move the bison on | our approximation |
| Fire Lookout | Gain 1 sun per hiker further along the trail | our approximation |
| Ranger Talk | Reserve the top card of the park deck, sight unseen | our approximation |

Only Memory Cliffs is taken from the published expansion — the other three card texts are not
published online, so those are ours, built in the same spirit.

### PARKS Europe

Not implemented: it is a **standalone 2026 game**, not an expansion, with its own systems (Via
Ferrata, fatigue, the Chalet, Conservation Projects) rather than modules that bolt onto this one.

### Season cards (base game)

Researching the expansions turned up a base-game element that was missing here entirely: one
**season card** is revealed from that season's own deck at the start of each season, and its effect
runs all season — weather that pays a bonus resource on top of a site's payout, or a discount on
parks, photos or gear. It is shown above the trail. The published season card also drops a sun or
water token onto each available park card; that role is already filled here by the season tokens on
trail sites, so it is left out.

## The CPU opponents

All three evaluate every legal move each turn and take the highest-value one, so they are
genuinely opportunistic: they take the site you left open and they price the turns they give
up by walking past sites.

| Opponent | Style |
| --- | --- |
| **Ranger Ada** | Banks resources, converts them into the highest-value parks in reach. |
| **Scout Bo** | Chases the camera, builds a photo and gear engine, then picks off cheap parks. |
| **Blazer Cy** | Tempo and denial: season tokens, the first player token, and the site you wanted. |

All three price the twelve-token cap, the re-lit campfire, and the four advanced sites (they will
trade away a dead resource, copy the best occupied site from an Overlook, and take the Ranger
Station's park action without giving up the rest of their trail).

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

Current results with both expansions on (40 games each): the CPUs average 64 points against a
shortest-step baseline that lands around 49–50. They price the campsites against the site they are
standing on, trade with the bison, and take a Season of Chance park when nothing on the board beats
it. With expansions off they average 49–51 against the baseline's 39–40.

Scores run high with the expansions in play — around 70 in a CPU-only table, with 10–11 parks each.
That is the expansions' own doing (a wildcard covering two resources is a large discount, and the
campsites trade at generous rates), amplified by the house rule that puts a token on every trail
site.

## Park artwork

Art is resolved in three steps, best first:

1. **Self-hosted.** Run `npm run art` and commit what it writes: `public/parks/<id>.jpg` plus a
   `credits.json` carrying each image's artist and license. The app then serves its own images and
   works offline. The script needs access to Wikipedia, so run it on your own machine or in CI —
   the container this was built in cannot reach Wikimedia.
2. **Wikipedia at runtime.** Without those files the browser asks the English Wikipedia API for
   each park's lead image (CORS-enabled) and caches the answer in `localStorage` for 30 days.
3. **Generated scenery.** Any park that resolves to nothing draws vector artwork keyed to its
   palette and terrain tags, so the board is never incomplete.

Either way the artist and license of every photograph shown is listed under **Credits** in the app.
Many are works of the U.S. National Park Service and in the public domain; others are Creative
Commons.

## Project layout

```
src/game/engine.ts          the transition layer: every action that advances the game
src/game/engine/primitives  resource bags, logging, spending
src/game/engine/rules       costs, payment, discounts, season effects, the token limit
src/game/engine/queries     legal moves, claimable parks, open campsites
src/game/engine/setup       new games, trail building, season and campsite decks
src/game/data/              parks, gear, bonuses, sites, campsites, season cards
src/game/ai.ts              the three CPU personalities
src/game/engine.test.ts     rules tests (62)
src/dev/                    CPU strength benchmarks, run by npm test
src/components/             board, trail, player panels, modals
src/art/                    local art, Wikipedia fallback, generated scenery
src/hooks/useGame.ts        game state, save/undo, the CPU turn driver
tests/game.spec.ts          browser tests (Playwright)
scripts/fetch-park-art.mjs  downloads park photographs for self-hosting
```

## Commands

```bash
npm run dev        # http://localhost:5173
npm test           # 62 rules tests plus the CPU benchmarks
npm run test:e2e   # browser tests against the production bundle
npm run build      # type-check and bundle to dist/
npm run art        # download park photographs into public/parks/ (needs Wikipedia access)
```

CI runs the build, the unit tests and the browser tests on every push.

The engine is a pure reducer: `applyAction(state, action)` returns a new state, and the CPU and
the UI both drive it through the same action list, so a game is fully replayable from its seed.
