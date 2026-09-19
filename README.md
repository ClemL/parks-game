# Trailside Seasons

A browser implementation of the *PARKS*-style hiking game: your hikers walk a trail collecting
resources, and spend them at the end of the trail to visit national parks — over four seasons.
Play solo against the CPUs, or round a tablet with everyone's hand on their own phone.

Built with React + TypeScript + Vite. Single-device play needs no backend at all; **table mode**
adds five small serverless routes and a Redis key per table.

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

`vercel.json` pins the Vite preset, the `dist` output, and rewrites everything except `/api/*` to
the app.

### Turning table mode on

Single-device play needs no database and no accounts. **Table mode** keeps each table in Redis, and
one command provisions one:

```bash
npm run redis
```

That posts to Upstash's agent endpoint, which mints a database with no signup and no console
clicking, writes the credentials into `.env.local` (gitignored), and prints both the values to set
on Vercel and a console URL. **Claim the database from that URL within three days or it is
deleted.** The idempotency key is kept in `.upstash-key.local`, so running the command again
returns the same database rather than a second one — which is also how to re-fetch the credentials
if you lose them.

Then set the same two variables on the deployment (Vercel → Settings → Environment Variables) and
redeploy. The routes read whichever of these pairs is present:

| Variable | Notes |
| --- | --- |
| `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` | What `npm run redis` writes; also what the Vercel Marketplace integration injects |
| `KV_REST_API_URL` + `KV_REST_API_TOKEN` | The names the old Vercel KV integration used; still honoured |

Never commit either. `.env.local` and `.upstash-key.local` are both covered by `.gitignore`.

With neither pair set, the routes fall back to an in-process store. That is exactly what you want
locally — `npm run dev` runs table mode with no account and no network — and exactly what you do
not want on a deployment, where each function instance would hold its own copy of the table.

So on a deployment with no store, **table mode switches itself off**: `GET /api/health` answers
`{"multiplayer": false}` with the reason, the app stops offering the Table mode button, and anyone
opening `#/table` or a seat link gets a short explanation and a way back to the single-device game.
Nothing fails, the build is untouched, and adding the variables turns it back on with no code
change.

Costs, for a sense of scale: five devices polling a version key is about 9,000 Redis commands per
45-minute session, against a 500,000-command monthly free tier — roughly 50 sessions a month for
nothing, and about two cents a session after that.

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
- **The season is named in the trail heading** — a `Spring 1/4` label beside the title — rather
  than shown as a row of four pips.
- **Clicking the turn indicator switches your hiker**, in the trail heading or the phone action
  bar. It shows which of your two hikers currently holds the highlight.
- **The trail log closes the board**, below every player panel.
- **The hikers stand on the left edge of the trail cards**, stacked with an overlap and a step to
  the right so a shared site reads as a crowd. The two ends of the trail wrap the stack into a
  second column, since every hiker in the game starts and finishes there. That takes the trail
  strip from 216px to 124px on a desktop, and to 106px in compact density.
- **Things move.** Pawns walk to their new site rather than teleporting (a FLIP animation, so it
  survives the card being rebuilt); a resource arriving or being spent pops its chip and floats the
  difference off it; parks, gear and bonus cards deal themselves in when bought, claimed or
  reserved; the score bumps when it changes. All of it is skipped under
  `prefers-reduced-motion: reduce`.
- **Every section folds away** — tap its heading. A folded section keeps a one-line summary (which
  campsites are out, what the gear shop is selling, the last log line), and each player folds to
  their resource chips plus a one-liner. What you fold is remembered.
- **The notices close** — the turn hint, the season card and the resume banner each have an X. The
  hint has a switch in Setup to bring it back; a closed season card returns when the next season
  deals its own.
- **On a phone** the board opens with the campsites, gear shop, trail log and CPU seats already
  folded, and the setup controls tucked behind a **Setup** button. That is about a third less
  scrolling than the fully open board, before you fold anything yourself.

## Table mode

One tablet in the middle of the table, one phone per player. Open it from **Table mode** in the top
bar, or go straight to `#/table`.

1. **The tablet deals the table.** Pick the number of seats and the expansions, and it opens a
   lobby with a five-letter code and **one QR code per seat**. Each code can be hidden and shown
   again, so a seat's link is not on display all game, and each carries its own secret — scanning
   seat 3's code cannot get you into seat 2.
2. **Phones scan and name themselves.** The code opens `#/hand`, which is that player's hand and
   nothing else. The tablet ticks the seat off as it is taken, without a reload.
3. **Start.** Every chair nobody took is played by a CPU, each with its own name and playing style.
   The bots also take their turns the moment the board is dealt, so the first human seat is on the
   clock straight away.

**What lives where**

- **The table** holds the shared board: the trail, the park row, the gear shop, the campsites, the
  log, and every seat's public holdings. Hikers are **dragged from card to card** here — the card
  under your finger lights up when it will take the drop, and an illegal drop snaps back. A banner
  across the top says whose turn it is, and when a decision is open it names the seat and the site:
  *"Kris is deciding: Camera Point"*.
- **Each phone** holds what only that player should see: their resources, their bottles and gear,
  their reserved parks and their bonus cards — and the **decision prompts their own moves open**.
  The rest of the table's public state is one fold away, closed by default. A phone can also move
  its own hikers, so a player can play entirely from their hand if they prefer.

**Secrets.** Nothing reaches a device that the player is not entitled to. The park deck's order and
the RNG cursor never leave the server (the cursor would predict every future draw, and so would the
seed, which is why no client is ever told it); the other seats' bonus cards arrive as the word
`hidden`; the parks they reserved out of the row arrive as a count, drawn face down. At scoring,
the server reveals everything.

**When a phone dies**, the tablet can play that seat: drag its hiker, and *Answer on the table*
takes over its decision. The tablet holds the host token, which is allowed to act for any seat.

**How it is wired.** No sockets. Each device asks `GET /api/state?since=<version>` and gets a single
number back when nothing has changed, which costs one Redis read; the poll runs at 1.2s while the
table is waiting on that device, 3s otherwise, and stops entirely while the screen is hidden. The
authoritative game state lives in Redis and only ever changes inside `POST /api/act`, which checks
that the seat is really on the clock, applies the move with the same pure reducer the solo game
uses, plays out any CPU turns behind it, and writes back with a Lua compare-and-set. There is no
undo in table mode: the server is the only copy of the truth. The service worker leaves `/api/`
alone, since a cached board would freeze a phone on a turn that has already been played.

That compare-and-set is the one piece with no second chance, so it is tested twice: against a
stand-in that pins the REST wire format, and against a real `redis-server` running the actual Lua —
including two writers racing for the same version, where exactly one gets through.

**Where it is unavailable** — a static host, the offline single-file build, a deployment with no
Redis store — the app asks `/api/health` once, finds no table server, and quietly does not offer
table mode. Single-device play is unaffected in every one of those cases.

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
- **A pinned action bar** keeps the turn indicator, a jump-to-trail button and Undo in reach. On a
  phone it is the only turn indicator, so the trail heading keeps its whole line — and it is where
  you tap to switch hikers.
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
- **Every site starts each season with a sun or water token on it, bar the trailhead and the first
  space out of it.** The first hiker to reach a site takes its token on top of the site's own
  payout.
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

A flask is filled from the stream you are standing in: **only the water your latest stop paid out
will fill one**. It stays available until one of your hikers walks on — so a stop that pays water
lets you empty a flask on the spot or at the top of your next turn — and water already banked in
your pack will not do. Each water drawn fills one flask, so a stop paying two water can empty two.

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
| No tokens sit on trail sites | Every site past the first space out of the trailhead holds a sun or water token for the first hiker there | Requested house rule |
| Vista: draw a canteen **or** take a photo | Camera Point: take the camera (+ optional photo) **or** take a bottle | Requested house rule; the camera moves on a site visit rather than on taking a photo |
| Photo costs any 2 tokens, 1 with the camera | 2 sun, 1 with the camera, wildcards may substitute | Requested (sun-priced) |
| Campfire is a token you flip, once per season | Same, as a counted token | Equivalent |
| First hiker to the Trail End takes the first player marker | First player to **reserve** a park takes it | Requested house rule |
| Each player drafts 1 of 2 dealt Year cards | Each player keeps **two** bonus cards, both scoring | Requested house rule |
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
| **Pikachu** | Banks resources, converts them into the highest-value parks in reach. |
| **Eevee** | Chases the camera, builds a photo and gear engine, then picks off cheap parks. |
| **Charizard** | Tempo and denial: season tokens, the first player token, and the site you wanted. |

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
src/game/view.ts            per-seat redaction: what one device is allowed to see
src/game/engine.test.ts     rules tests
src/dev/                    CPU strength benchmarks, run by npm test
src/components/             board, trail, player panels, modals, seat QR codes
src/art/                    local art, Wikipedia fallback, generated scenery
src/hooks/useGame.ts        solo game state, save/undo, the CPU turn driver
src/hooks/useTable.ts       table mode: the polling transport
src/hooks/useDragPawn.ts    dragging a hiker to its next site
src/net/table.ts            table lifecycle, seat authority, the CPU driver
src/net/kv.ts               the Redis slice used, over Upstash REST or in process
src/net/upstash.test.ts     the REST client against an Upstash-shaped stand-in
src/net/upstash-redis.test.ts  the same client against a real Redis, Lua and all
src/net/routes.ts           one dispatcher, shared by Vercel and the dev server
src/Root.tsx                #/ solo, #/table the shared board, #/hand a phone
api/                        five Vercel functions, one line each over routes.ts
tests/game.spec.ts          browser tests, single device (Playwright)
tests/table.spec.ts         browser tests, a tablet and phones together
scripts/fetch-park-art.mjs  downloads park photographs for self-hosting
scripts/build-artifact.mjs  bundles the build into one self-contained page
scripts/start-redis.mjs     provisions the table-mode database in one command
```

## Commands

```bash
npm run dev        # http://localhost:5173
npm test           # rules, redaction and table-authority tests, plus the CPU benchmarks
npm run test:e2e   # browser tests against the production bundle
npm run build      # type-check and bundle to dist/
npm run art        # download park photographs into public/parks/ (needs Wikipedia access)
npm run redis      # provision the Redis database table mode needs, into .env.local
```

CI runs the build, the unit tests and the browser tests on every push.

The engine is a pure reducer: `applyAction(state, action)` returns a new state, and the CPU and
the UI both drive it through the same action list, so a game is fully replayable from its seed.
That is also what makes table mode cheap: the server runs the same reducer, and a whole four-season
game is only a few hundred actions at well under a millisecond each.
