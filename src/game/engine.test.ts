import { describe, expect, it } from 'vitest';
import {
  applyAction,
  bagTotal,
  bisonPark,
  campfireAllowance,
  canClaimChance,
  claimableParks,
  copyableSites,
  createGame,
  legalMoves,
  effectiveCost,
  gearCost,
  occupants,
  openCampsites,
  photoCost,
  planPayment,
  wildCoverage,
  reservableParks,
  SEASONS,
  siteDef,
  tokenCount,
  usableBottles,
} from './engine';
import { aiAction } from './ai';
import { GEAR_VP } from './data/sites';
import { scoreGame } from './scoring';
import {
  ADVANCED_SITES,
  basicSitesFor,
  MAX_PLAYERS,
  MIN_PLAYERS,
  parkRowSizeFor,
  WILDLIFE_SITES,
  PHOTO_COST,
  PHOTO_COST_DISCOUNTED,
  TOKEN_LIMIT,
} from './data/sites';
import type { GameState } from './types';

function allCpu(seed: number): GameState {
  const state = createGame({ seed });
  state.players[0].isHuman = false;
  state.players[0].personality = 'collector';
  return state;
}

/** Drive a full game with every seat played by the AI. */
function playOut(seed: number): GameState {
  let state = allCpu(seed);
  for (let step = 0; step < 5000; step++) {
    if (state.phase === 'game-over') return state;
    const action = aiAction(state);
    expect(action, `no action available at step ${step}`).not.toBeNull();
    const before = JSON.stringify(state);
    state = applyAction(state, action!);
    if (before === JSON.stringify(state) && state.phase === 'playing') {
      throw new Error(`AI action made no progress: ${JSON.stringify(action)}`);
    }
  }
  throw new Error('game did not finish within the step budget');
}

/** A game with no expansions, for testing base-game behaviour in isolation. */
function baseGame(seed: number): GameState {
  return createGame({ seed, expansions: { nightfall: false, wildlife: false } });
}

/**
 * Drop a specific site onto the trail so its behaviour can be tested without
 * hunting for a seed that happens to deal it. Clears the tent and season token
 * there so only the site's own action is in play.
 */
function putSite(state: GameState, kind: GameState['trail'][number], index = 1): number {
  state.trail[index] = kind;
  state.siteTokens[index] = null;
  state.tentSites = state.tentSites.filter((i) => i !== index);
  state.seasonCard = null;
  return index;
}

/** Walk a hiker to the Trail End so its decision can be inspected. */
function arriveAtEnd(state: GameState, hikerId = 'p0h0'): GameState {
  state.current = Number(hikerId[1]);
  return applyAction(state, { type: 'move', hikerId, to: state.trail.length - 1 });
}

describe('setup', () => {
  it('gives every player two hikers, one bottle, one campfire and two bonus cards', () => {
    const state = createGame({ seed: 42 });
    expect(state.players).toHaveLength(4);
    for (const player of state.players) {
      expect(player.hikers).toHaveLength(2);
      expect(player.hikers.every((h) => h.position === 0)).toBe(true);
      expect(player.bottles).toHaveLength(1);
      expect(player.bottles[0].used).toBe(false);
      expect(player.campfires).toBe(1);
      expect(player.bonusCards).toHaveLength(2);
    }
    expect(new Set(state.players.flatMap((p) => p.bonusCards)).size).toBe(8);
    expect(state.players.filter((p) => !p.isHuman)).toHaveLength(3);
    expect(state.cameraHolder).toBeNull();
    // Expansions open a fourth park slot; the base game shows three.
    expect(state.parkRow).toHaveLength(parkRowSizeFor(state.expansions));
    expect(parkRowSizeFor({ nightfall: false, wildlife: false })).toBe(3);
    expect(parkRowSizeFor({ nightfall: true, wildlife: false })).toBe(4);
    // Four players means two early-buyer gear discounts.
    expect(state.gearDiscountsLeft).toBe(2);
  });

  it('puts every basic site on the trail and adds one advanced site per season', () => {
    for (const seed of [7, 8, 9]) {
      let state = createGame({ seed });
      const lengths: number[] = [];
      for (let season = 1; season <= SEASONS; season++) {
        lengths.push(state.trail.length);
        expect(state.trail[0]).toBe('trailhead');
        expect(state.trail[state.trail.length - 1]).toBe('trail-end');

        const middle = state.trail.slice(1, -1);
        // One of each basic site, every season.
        for (const basic of basicSitesFor(state.players.length)) {
          expect(middle.filter((k) => k === basic), `${basic} in season ${season}`).toHaveLength(1);
        }
        // Exactly `season` advanced sites, all different, in a stable order.
        const advancedPool = [...ADVANCED_SITES, ...WILDLIFE_SITES];
        const advanced = middle.filter((k) => advancedPool.includes(k));
        expect(advanced).toHaveLength(season);
        expect(new Set(advanced).size).toBe(season);
        expect(new Set(advanced)).toEqual(new Set(state.advancedOrder.slice(0, season)));

        state.phase = 'season-end';
        if (season < SEASONS) state = applyAction(state, { type: 'end-season' });
      }
      expect(lengths).toEqual([9, 10, 11, 12]);
      // By winter four advanced sites are in play, starting with the park site.
      const pool = [...ADVANCED_SITES, ...WILDLIFE_SITES];
      expect(new Set(state.trail.filter((k) => pool.includes(k))).size).toBe(4);
      expect(state.advancedOrder[0]).toBe('adv-park');
    }
  });

  it('is deterministic for a given seed', () => {
    expect(JSON.stringify(createGame({ seed: 99 }))).toBe(JSON.stringify(createGame({ seed: 99 })));
  });
});

describe('season tokens', () => {
  it('skips the trailhead, the first space out of it, and the end', () => {
    const state = createGame({ seed: 5 });
    expect(state.siteTokens[0]).toBeNull();
    expect(state.siteTokens[1]).toBeNull();
    expect(state.siteTokens[state.trail.length - 1]).toBeNull();
    const rest = state.siteTokens.slice(2, -1);
    expect(rest).toHaveLength(state.trail.length - 3);
    expect(rest.every((t) => t === 'sun' || t === 'water')).toBe(true);
  });

  it('gives the token to the first hiker there and to nobody after', () => {
    const state = createGame({ seed: 5 });
    state.seasonCard = null;
    state.tentSites = [];
    // Pick a plain resource site past the bare first space, so only its own
    // payout and the token apply.
    const target = state.trail.findIndex((k, i) => i > 1 && (k === 'forest' || k === 'mountain'));
    const token = state.siteTokens[target]!;
    const sitePays = siteDef(state.trail[target]).gain?.[token] ?? 0;
    state.current = 0;

    const first = applyAction(state, { type: 'move', hikerId: 'p0h0', to: target });
    expect(first.players[0].resources[token]).toBe(sitePays + 1);
    expect(first.siteTokens[target]).toBeNull();

    // A second hiker sharing the site with a campfire gets the site, not the token.
    first.current = 1;
    const before = first.players[1].resources[token] ?? 0;
    const second = applyAction(first, { type: 'move', hikerId: 'p1h0', to: target, useCampfire: true });
    expect(second.players[1].resources[token] ?? 0).toBe(before + sitePays);
  });

  it('lays fresh tokens out for the next season', () => {
    let state = createGame({ seed: 5 });
    state.siteTokens = state.siteTokens.map(() => null);
    state.phase = 'season-end';
    state = applyAction(state, { type: 'end-season' });
    expect(state.siteTokens.slice(2, -1).every((t) => t !== null)).toBe(true);
    expect(state.siteTokens[1]).toBeNull();
  });
});

describe('occupancy', () => {
  it('blocks a second hiker on a site unless a campfire is spent', () => {
    const state = createGame({ seed: 11 });
    const target = 3;
    state.players[1].hikers[0].position = target;
    state.current = 0;
    state.players[0].campfires = 0;

    expect(legalMoves(state).filter((m) => m.to === target)).toHaveLength(0);

    state.players[0].campfires = 1;
    const withFire = legalMoves(state).filter((m) => m.to === target);
    expect(withFire.length).toBeGreaterThan(0);
    expect(withFire.every((m) => m.useCampfire)).toBe(true);

    const next = applyAction(state, { type: 'move', hikerId: 'p0h0', to: target, useCampfire: true });
    expect(next.players[0].campfires).toBe(0);
    expect(occupants(next, target)).toHaveLength(2);
  });

  it('re-lights the campfire when a player first hiker comes home', () => {
    const state = createGame({ seed: 14 });
    state.current = 0;
    state.players[0].campfires = 0;
    expect(campfireAllowance(state.players[0])).toBe(1);

    let next = applyAction(state, { type: 'move', hikerId: 'p0h0', to: state.trail.length - 1 });
    expect(next.players[0].campfires).toBe(1);
    expect(next.players[0].campfireRelit).toBe(true);

    // Only once per season: the second hiker home does not add another.
    next = applyAction(next, { type: 'trail-end', option: 'rest' });
    next.current = 0;
    next.players[0].campfires = 0;
    next = applyAction(next, { type: 'move', hikerId: 'p0h1', to: next.trail.length - 1 });
    expect(next.players[0].campfires).toBe(0);
  });

  it('refills each player to one campfire every season', () => {
    let state = createGame({ seed: 12 });
    state.players[0].campfires = 0;
    state.players[1].campfires = 1;
    state.phase = 'season-end';
    state = applyAction(state, { type: 'end-season' });
    expect(state.players.map((p) => p.campfires)).toEqual([1, 1, 1, 1]);
  });
});

describe('camera', () => {
  function walkToCamera(seed: number) {
    const state = createGame({ seed });
    const index = putSite(state, 'camera');
    state.current = 0;
    return { state, index };
  }

  it('hands the camera over and offers an immediate photo for 1 sun', () => {
    const { state, index } = walkToCamera(21);
    state.players[0].resources.sun = 3;
    let next = applyAction(state, { type: 'move', hikerId: 'p0h0', to: index });
    expect(next.pending?.kind).toBe('camera');

    next = applyAction(next, { type: 'camera', option: 'take-camera' });
    expect(next.cameraHolder).toBe(0);
    expect(next.pending?.stage).toBe('take-photo');
    expect(photoCost(next, 0)).toBe(PHOTO_COST_DISCOUNTED);

    const sunBefore = next.players[0].resources.sun ?? 0;
    next = applyAction(next, { type: 'camera-photo', take: true });
    expect(next.players[0].photos).toBe(1);
    expect(next.players[0].resources.sun).toBe(sunBefore - PHOTO_COST_DISCOUNTED);
    expect(next.pending).toBeNull();
  });

  it('gives a bottle instead when the camera is declined', () => {
    const { state, index } = walkToCamera(21);
    let next = applyAction(state, { type: 'move', hikerId: 'p0h0', to: index });
    next = applyAction(next, { type: 'camera', option: 'take-bottle' });
    expect(next.cameraHolder).toBeNull();
    expect(next.players[0].bottles).toHaveLength(2);
    expect(next.pending).toBeNull();
  });

  it('lets a later visitor steal the camera', () => {
    const { state, index } = walkToCamera(21);
    state.cameraHolder = 2;
    // Nothing at all to pay with, so no photo can follow.
    state.players[0].resources = { sun: 0, water: 0, forest: 0, mountain: 0, wild: 0 };
    let next = applyAction(state, { type: 'move', hikerId: 'p0h0', to: index });
    next = applyAction(next, { type: 'camera', option: 'take-camera' });
    expect(next.cameraHolder).toBe(0);
    // No sun, so there is no photo to offer and the turn simply ends.
    expect(next.pending).toBeNull();
  });

  it('charges non-holders the full photo price', () => {
    const state = createGame({ seed: 22 });
    state.cameraHolder = 1;
    expect(photoCost(state, 0)).toBe(PHOTO_COST);
    expect(photoCost(state, 1)).toBe(PHOTO_COST_DISCOUNTED);
  });
});

describe('bottles', () => {
  it('converts one water into the bottle output, once per season', () => {
    const state = createGame({ seed: 31 });
    const player = state.players[0];
    player.bottles = [{ id: 'b', kind: 'sun-flask', used: false }];
    player.resources = { sun: 0, water: 2, forest: 0, mountain: 0, wild: 0 };
    player.waterThisTurn = 2;
    state.current = 0;

    expect(usableBottles(player)).toHaveLength(1);
    const next = applyAction(state, { type: 'use-bottle', bottleId: 'b' });
    expect(next.players[0].resources.water).toBe(1);
    expect(next.players[0].resources.sun).toBe(2);
    expect(next.players[0].bottles[0].used).toBe(true);

    const again = applyAction(next, { type: 'use-bottle', bottleId: 'b' });
    expect(again.players[0].resources.sun).toBe(2);
  });

  it('needs water to use', () => {
    const state = createGame({ seed: 32 });
    state.players[0].resources = { sun: 0, water: 0, forest: 0, mountain: 0, wild: 0 };
    expect(usableBottles(state.players[0])).toHaveLength(0);
  });

  it('fills only from water drawn this turn', () => {
    const state = createGame({ seed: 34 });
    const player = state.players[0];
    player.bottles = [{ id: 'b', kind: 'sun-flask', used: false }];
    // Water carried over from an earlier turn will not fill a flask.
    player.resources = { sun: 0, water: 3, forest: 0, mountain: 0, wild: 0 };
    player.waterThisTurn = 0;
    state.current = 0;
    expect(usableBottles(player)).toHaveLength(0);

    const refused = applyAction(state, { type: 'use-bottle', bottleId: 'b' });
    expect(refused.players[0].resources.water).toBe(3);
    expect(refused.players[0].bottles[0].used).toBe(false);

    // One water drawn this turn is enough for exactly one flask.
    player.waterThisTurn = 1;
    expect(usableBottles(player)).toHaveLength(1);
    const used = applyAction(state, { type: 'use-bottle', bottleId: 'b' });
    expect(used.players[0].bottles[0].used).toBe(true);
    expect(used.players[0].resources.water).toBe(2);
    expect(used.players[0].waterThisTurn).toBe(0);
  });

  it('counts the water a site pays out as drawn this turn', () => {
    const state = createGame({ seed: 35 });
    state.seasonCard = null;
    state.tentSites = [];
    state.current = 0;
    // The Valley pays water; walking there should make a flask usable.
    const valley = state.trail.findIndex((k, i) => i > 1 && k === 'valley');
    if (valley < 0) return;
    const after = applyAction(state, { type: 'move', hikerId: 'p0h0', to: valley });
    expect(after.players[0].waterThisTurn).toBeGreaterThan(0);
    expect(usableBottles(after.players[0]).length).toBeGreaterThan(0);
  });

  it('lets the water go stale as soon as the hiker walks on', () => {
    const state = createGame({ seed: 36 });
    state.seasonCard = null;
    state.tentSites = [];
    state.current = 0;
    const valley = state.trail.findIndex((k, i) => i > 1 && k === 'valley');
    if (valley < 0) return;

    const mine = applyAction(state, { type: 'move', hikerId: 'p0h0', to: valley });
    expect(mine.players[0].waterThisTurn).toBeGreaterThan(0);

    // Round the table and back: the water this stop paid is still fresh, so the
    // flask can be emptied at the top of the next turn.
    let next = mine;
    for (let step = 0; step < 60 && next.current !== 0; step++) {
      const action = aiAction(next);
      if (!action) break;
      next = applyAction(next, action);
    }
    expect(next.current).toBe(0);
    expect(next.phase).toBe('playing');
    expect(next.players[0].waterThisTurn).toBeGreaterThan(0);
    expect(usableBottles(next.players[0]).length).toBeGreaterThan(0);

    // Walking on again is what ages it: the water stays in the pack, but no
    // flask will take it. Walk to a dry site, so nothing refreshes the counter.
    next.siteTokens = next.siteTokens.map(() => null);
    const dry = legalMoves(next).find(
      (m) => m.hikerId !== 'p0h0' && (siteDef(next.trail[m.to]).gain?.water ?? 0) === 0,
    );
    expect(dry, 'a dry site to walk to').toBeDefined();
    const walked = applyAction(next, {
      type: 'move',
      hikerId: dry!.hikerId,
      to: dry!.to,
      useCampfire: dry!.useCampfire,
    });
    expect(walked.players[0].waterThisTurn).toBe(0);
    expect((walked.players[0].resources.water ?? 0) > 0).toBe(true);
    expect(usableBottles(walked.players[0])).toHaveLength(0);
  });

  it('refills every bottle at the season break', () => {
    let state = createGame({ seed: 33 });
    state.players[0].bottles = [{ id: 'b', kind: 'pine-flask', used: true }];
    state.phase = 'season-end';
    state = applyAction(state, { type: 'end-season' });
    expect(state.players[0].bottles[0].used).toBe(false);
  });
});

describe('advanced sites', () => {
  /** Put a hiker on the named advanced site and return the pending state. */
  function landOn(kind: GameState['trail'][number], seed = 61, setup?: (s: GameState) => void) {
    const state = createGame({ seed });
    const index = putSite(state, kind);
    state.current = 0;
    setup?.(state);
    return { state: applyAction(state, { type: 'move', hikerId: 'p0h0', to: index }), index };
  }

  it('Wildlife Hide trades a resource for a wildcard', () => {
    const { state } = landOn('adv-wildcard', 61, (s) => {
      s.players[0].resources = { sun: 2, water: 0, forest: 0, mountain: 0, wild: 0 };
    });
    expect(state.pending?.kind).toBe('wild-swap');
    const next = applyAction(state, { type: 'swap-give', resource: 'sun' });
    expect(next.players[0].resources.wild).toBe(1);
    expect(next.players[0].resources.sun).toBeLessThan(3);
    expect(next.pending).toBeNull();
  });

  it('Trading Post swaps a resource for a different one, twice', () => {
    const { state } = landOn('adv-swap', 61, (s) => {
      s.players[0].resources = { sun: 3, water: 0, forest: 0, mountain: 0, wild: 0 };
    });
    expect(state.pending?.kind).toBe('token-swap');
    expect(state.pending?.swapsLeft).toBe(2);
    const sunBefore = state.players[0].resources.sun ?? 0;

    let next = applyAction(state, { type: 'swap-give', resource: 'sun' });
    expect(next.pending?.stage).toBe('get');
    next = applyAction(next, { type: 'swap-get', resource: 'mountain' });
    expect(next.players[0].resources.mountain).toBe(1);
    expect(next.pending?.swapsLeft).toBe(1);
    expect(next.pending?.stage).toBe('give');

    next = applyAction(next, { type: 'swap-give', resource: 'sun' });
    next = applyAction(next, { type: 'swap-get', resource: 'forest' });
    expect(next.players[0].resources.forest).toBe(1);
    expect(next.players[0].resources.sun).toBe(sunBefore - 2);
    expect(next.pending).toBeNull();

    // A swap may not hand back the same resource it took.
    const again = applyAction(state, { type: 'swap-give', resource: 'sun' });
    const rejected = applyAction(again, { type: 'swap-get', resource: 'sun' });
    expect(rejected.pending?.stage).toBe('get');
  });

  it('lets a player stop a Trading Post early', () => {
    const { state } = landOn('adv-swap', 61);
    const next = applyAction(state, { type: 'swap-done' });
    expect(next.pending).toBeNull();
  });

  it('Ranger Station offers parks and gear without retiring the hiker', () => {
    const { state, index } = landOn('adv-park', 61, (s) => {
      s.players[0].resources = { sun: 9, water: 9, forest: 9, mountain: 9, wild: 0 };
    });
    expect(state.pending?.kind).toBe('park-or-gear');
    const park = claimableParks(state, 0)[0];
    const next = applyAction(state, { type: 'park-or-gear', option: 'claim-park', parkId: park.id });
    expect(next.players[0].parks.map((p) => p.id)).toContain(park.id);
    // The hiker is still on the trail, not finished.
    expect(next.players[0].hikers[0].finished).toBe(false);
    expect(next.players[0].hikers[0].position).toBe(index);
  });

  it('Ranger Station reservation also takes the first player token', () => {
    const { state } = landOn('adv-park', 61);
    const park = reservableParks(state)[0];
    const next = applyAction(state, { type: 'park-or-gear', option: 'reserve-park', parkId: park.id });
    expect(next.firstPlayer).toBe(0);
    expect(next.firstPlayerTokenClaimed).toBe(true);
  });

  it('copies a Ranger Station into a second park visit in one season', () => {
    // The rulebook's own combo: a hiker at an Overlook can copy the Ranger
    // Station, so a season is not capped at two park visits.
    const state = createGame({ seed: 63 });
    const overlook = putSite(state, 'adv-copy', 1);
    const station = putSite(state, 'adv-park', 2);
    state.players[1].hikers[0].position = station;
    state.current = 0;
    state.players[0].resources = { sun: 9, water: 9, forest: 9, mountain: 9, wild: 0 };

    let next = applyAction(state, { type: 'move', hikerId: 'p0h0', to: overlook });
    expect(next.pending?.kind).toBe('copy-site');
    next = applyAction(next, { type: 'copy-site', siteIndex: station });
    // The copied site opens the Ranger Station's own menu.
    expect(next.pending?.kind).toBe('park-or-gear');
    expect(next.pending?.copied).toBe(true);

    const park = claimableParks(next, 0)[0];
    next = applyAction(next, { type: 'park-or-gear', option: 'claim-park', parkId: park.id });
    expect(next.players[0].parks).toHaveLength(1);
    expect(next.players[0].hikers[0].finished).toBe(false);
  });

  it('Overlook pays 1 water to copy an occupied site', () => {
    const state = createGame({ seed: 62 });
    const overlook = putSite(state, 'adv-copy', 1);
    const valley = putSite(state, 'valley', 2);
    // An opponent is standing on the Valley, so its action can be copied.
    state.players[1].hikers[0].position = valley;
    state.current = 0;
    state.players[0].resources = { sun: 0, water: 1, forest: 0, mountain: 0, wild: 0 };

    let next = applyAction(state, { type: 'move', hikerId: 'p0h0', to: overlook });
    expect(next.pending?.kind).toBe('copy-site');
    expect(copyableSites(next, 0)).toContain(valley);

    next = applyAction(next, { type: 'copy-site', siteIndex: valley });
    // Paid 1 water, gained 2 from the copied Valley.
    expect(next.players[0].resources.water).toBe(2);
    expect(next.pending).toBeNull();
  });

  it('offers no copy without water or without an occupied site', () => {
    const state = createGame({ seed: 62 });
    const overlook = putSite(state, 'adv-copy');
    state.current = 0;
    state.players[0].resources = { sun: 0, water: 0, forest: 0, mountain: 0, wild: 0 };
    const next = applyAction(state, { type: 'move', hikerId: 'p0h0', to: overlook });
    // Nothing to decide, so the stop simply passes.
    expect(next.pending).toBeNull();
    expect(copyableSites(next, 0)).toHaveLength(0);
  });
});

describe('the Trail End', () => {
  it('pays for a park with resources and wildcards', () => {
    const state = createGame({ seed: 41 });
    const park = state.parkRow[0];
    const player = state.players[0];
    player.resources = { sun: 0, water: 0, forest: 0, mountain: 0, wild: 1 };
    const keys = Object.keys(park.cost) as (keyof typeof park.cost)[];
    for (const k of keys) player.resources[k] = park.cost[k] ?? 0;
    player.resources[keys[0]] = (player.resources[keys[0]] ?? 0) - 1;

    expect(claimableParks(state, 0).some((p) => p.id === park.id)).toBe(true);
    let next = arriveAtEnd(state);
    next = applyAction(next, { type: 'trail-end', option: 'claim-park', parkId: park.id });
    expect(next.players[0].parks.map((p) => p.id)).toContain(park.id);
    expect(next.players[0].resources.wild).toBe(0);
    expect(next.parkRow.some((p) => p.id === park.id)).toBe(false);
  });

  it('allows only one park per Trail End action, however rich the player', () => {
    // No Wildlife, so a bison trade cannot interrupt the check.
    const state = baseGame(46);
    state.players[0].resources = { sun: 12, water: 12, forest: 12, mountain: 12, wild: 12 };
    const first = claimableParks(state, 0)[0];

    let next = arriveAtEnd(state);
    next = applyAction(next, { type: 'trail-end', option: 'claim-park', parkId: first.id });
    expect(next.players[0].parks).toHaveLength(1);
    // The action is spent: the decision is closed and a second claim is ignored.
    expect(next.pending).toBeNull();
    const second = claimableParks(next, 0)[0];
    const again = applyAction(next, { type: 'trail-end', option: 'claim-park', parkId: second.id });
    expect(again.players[0].parks).toHaveLength(1);
  });

  it('hands the first player token to the first reservation of the season', () => {
    const state = createGame({ seed: 42 });
    state.firstPlayer = 3;
    const park = reservableParks(state)[0];
    let next = arriveAtEnd(state);
    next = applyAction(next, { type: 'trail-end', option: 'reserve-park', parkId: park.id });
    expect(next.players[0].reserved.map((p) => p.id)).toContain(park.id);
    expect(next.firstPlayer).toBe(0);
    expect(next.firstPlayerTokenClaimed).toBe(true);

    // A later reservation in the same season does not move the token again.
    const second = reservableParks(next)[0];
    next.current = 1;
    let later = applyAction(next, { type: 'move', hikerId: 'p1h0', to: next.trail.length - 1 });
    later = applyAction(later, { type: 'trail-end', option: 'reserve-park', parkId: second.id });
    expect(later.firstPlayer).toBe(0);
  });

  it('gives the first two gear buyers a discount at four players, then nobody', () => {
    let state = createGame({ seed: 43 });
    for (const player of state.players) player.resources.sun = 9;

    const buy = (seat: number) => {
      const card = state.gearRow.find((g) => !state.players[seat].gear.some((o) => o.id === g.id))!;
      const before = state.players[seat].resources.sun ?? 0;
      state.current = seat;
      state = applyAction(state, { type: 'move', hikerId: `p${seat}h0`, to: state.trail.length - 1 });
      state = applyAction(state, { type: 'trail-end', option: 'buy-gear', gearId: card.id });
      return before - (state.players[seat].resources.sun ?? 0) === card.cost - 1;
    };

    expect(buy(0)).toBe(true);
    expect(state.gearDiscountsLeft).toBe(1);
    expect(buy(1)).toBe(true);
    expect(state.gearDiscountsLeft).toBe(0);
    expect(buy(2)).toBe(false);
  });

  it('offers the discounts again in the next season', () => {
    let state = createGame({ seed: 44 });
    state.gearDiscountsLeft = 0;
    state.phase = 'season-end';
    state = applyAction(state, { type: 'end-season' });
    expect(state.gearDiscountsLeft).toBe(2);
    expect(state.firstPlayerTokenClaimed).toBe(false);
  });

  it('keeps a reserved park away from everyone else', () => {
    const state = createGame({ seed: 45 });
    const park = state.parkRow[1];
    state.players[1].reserved.push(park);
    const rich = { sun: 9, water: 9, forest: 9, mountain: 9, wild: 9 };
    state.players[0].resources = { ...rich };
    state.players[1].resources = { ...rich };
    expect(claimableParks(state, 0).some((p) => p.id === park.id)).toBe(false);
    expect(claimableParks(state, 1).some((p) => p.id === park.id)).toBe(true);
    expect(reservableParks(state).some((p) => p.id === park.id)).toBe(false);
  });
});

describe('resources', () => {
  it('keeps every resource between seasons, sun included', () => {
    let state = createGame({ seed: 51 });
    state.players[0].resources = { sun: 4, water: 2, forest: 1, mountain: 0, wild: 3 };
    state.phase = 'season-end';
    state = applyAction(state, { type: 'end-season' });
    expect(state.players[0].resources).toMatchObject({ sun: 4, water: 2, forest: 1, wild: 3 });
    expect(state.season).toBe(2);
  });

  it('discards down to twelve tokens at the end of a turn, sun first', () => {
    const state = createGame({ seed: 53 });
    const index = putSite(state, 'valley');
    state.current = 0;
    state.players[0].resources = { sun: 5, water: 3, forest: 3, mountain: 1, wild: 1 };
    const next = applyAction(state, { type: 'move', hikerId: 'p0h0', to: index });
    expect(tokenCount(next.players[0])).toBe(TOKEN_LIMIT);
    // Sun is shed before anything else, and wildcards are kept.
    expect(next.players[0].resources.wild).toBe(1);
    expect(next.players[0].resources.sun).toBeLessThan(5);
  });

  it('pays for a photo with a wildcard when sun runs short', () => {
    const state = baseGame(54);
    state.seasonCard = null;
    state.cameraHolder = null;
    state.players[0].resources = { sun: 1, water: 0, forest: 0, mountain: 0, wild: 2 };
    let next = arriveAtEnd(state);
    next = applyAction(next, { type: 'trail-end', option: 'photo' });
    expect(next.players[0].photos).toBe(1);
    expect(next.players[0].resources.sun).toBe(0);
    expect(next.players[0].resources.wild).toBe(1);
  });

  it('never asks a park for wildlife, which is a wildcard now', () => {
    const state = createGame({ seed: 52 });
    for (const park of [...state.parkRow, ...state.parkDeck]) {
      expect(park.cost.wild ?? 0).toBe(0);
    }
  });
});

describe('table size', () => {
  it('seats two to five players, and clamps anything else', () => {
    for (let seats = MIN_PLAYERS; seats <= MAX_PLAYERS; seats++) {
      const state = createGame({ seed: 101, players: seats });
      expect(state.players).toHaveLength(seats);
      expect(state.players.filter((p) => p.isHuman)).toHaveLength(1);
      expect(state.players.filter((p) => !p.isHuman)).toHaveLength(seats - 1);
      expect(state.players.every((p) => p.isHuman || p.personality)).toBe(true);
      // Every seat gets its own colour and its own hikers.
      expect(new Set(state.players.map((p) => p.color)).size).toBe(seats);
      expect(new Set(state.players.flatMap((p) => p.hikers.map((h) => h.id))).size).toBe(seats * 2);
    }
    expect(createGame({ seed: 101, players: 9 }).players).toHaveLength(MAX_PLAYERS);
    expect(createGame({ seed: 101, players: 1 }).players).toHaveLength(MIN_PLAYERS);
  });

  it('adds the Waterfall only at four or more players', () => {
    const small = createGame({ seed: 102, players: 3 });
    const big = createGame({ seed: 102, players: 4 });
    expect(small.trail).not.toContain('waterfall');
    expect(big.trail).toContain('waterfall');
    expect(big.trail.length).toBe(small.trail.length + 1);
    expect(basicSitesFor(3)).toHaveLength(5);
    expect(basicSitesFor(5)).toHaveLength(6);
  });

  it('scales the campsite slots and gear discounts with the table', () => {
    const small = createGame({ seed: 103, players: 3, expansions: { nightfall: true, wildlife: false } });
    const big = createGame({ seed: 103, players: 5, expansions: { nightfall: true, wildlife: false } });
    expect(small.gearDiscountsLeft).toBe(1);
    expect(big.gearDiscountsLeft).toBe(2);
    small.campsites[0].tents = [1];
    expect(openCampsites(small).some((c) => c.id === small.campsites[0].id)).toBe(false);
    big.campsites[0].tents = [1];
    expect(openCampsites(big).some((c) => c.id === big.campsites[0].id)).toBe(true);
  });

  it('plays a full game at every table size', () => {
    for (let seats = MIN_PLAYERS; seats <= MAX_PLAYERS; seats++) {
      let state = createGame({ seed: 104 + seats, players: seats });
      for (const p of state.players) p.isHuman = false;
      state.players[0].personality = 'collector';
      for (let i = 0; i < 9000 && state.phase !== 'game-over'; i++) {
        state = applyAction(state, aiAction(state)!);
      }
      expect(state.phase, `seats ${seats}`).toBe('game-over');
      expect(state.finalScores).toHaveLength(seats);
    }
  });
});

describe('scoring', () => {
  it('scores gear cards as well as parks, photos and bonuses', () => {
    let state = createGame({ seed: 105, expansions: { nightfall: false, wildlife: false } });
    state.players[0].gear = [state.gearRow[0], state.gearRow[1]];
    state.phase = 'game-over';
    state = applyAction(state, { type: 'end-season' });
    const scores = scoreGame(state);
    const mine = scores.find((s) => s.player === 0)!;
    expect(mine.gearVp).toBe(2 * GEAR_VP);
    expect(mine.total).toBe(
      mine.parkVp + mine.photoVp + mine.gearVp + mine.bonusVp + mine.firstPlayerVp + mine.leftoverVp,
    );
  });

  it('never asks a park for sun, which now only buys gear and photos', () => {
    const state = createGame({ seed: 106 });
    for (const park of [...state.parkRow, ...state.parkDeck]) {
      expect(park.cost.sun ?? 0, park.name).toBe(0);
    }
  });
});

describe('season cards (base game)', () => {
  it('reveals one card per season, from that season deck', () => {
    let state = createGame({ seed: 71 });
    expect(state.seasonDeck).toHaveLength(4);
    for (let season = 1; season <= SEASONS; season++) {
      expect(state.seasonCard?.season).toBe(season);
      state.phase = 'season-end';
      if (season < SEASONS) state = applyAction(state, { type: 'end-season' });
    }
  });

  it('pays the weather bonus on top of a site payout', () => {
    const state = createGame({ seed: 72 });
    const index = putSite(state, 'mountain');
    state.seasonCard = {
      id: 'test',
      name: 'Season of Snow',
      season: 1,
      text: 'Gaining mountain also pays 1 water.',
      effect: { kind: 'weather', when: 'mountain', gain: { water: 1 } },
    };
    state.current = 0;
    state.players[0].resources = { sun: 0, water: 0, forest: 0, mountain: 0, wild: 0 };
    const next = applyAction(state, { type: 'move', hikerId: 'p0h0', to: index });
    expect(next.players[0].resources.mountain).toBe(1);
    expect(next.players[0].resources.water).toBe(1);
  });

  it('applies the seasonal park, photo and gear discounts', () => {
    const state = baseGame(73);
    const park = state.parkRow[0];
    const plain = bagTotal(effectiveCost(state.players[0], park, state));
    state.seasonCard = {
      id: 'test',
      name: 'Season of Harvest',
      season: 1,
      text: 'Parks cost 1 less.',
      effect: { kind: 'park-discount', amount: 1 },
    };
    expect(bagTotal(effectiveCost(state.players[0], park, state))).toBe(plain - 1);

    state.seasonCard = {
      id: 'test2',
      name: 'Season of Long Light',
      season: 1,
      text: 'Photos cost 1 less.',
      effect: { kind: 'cheap-photos', amount: 1 },
    };
    expect(photoCost(state, 0)).toBe(PHOTO_COST - 1);

    state.seasonCard = {
      id: 'test3',
      name: 'Season of Outfitters',
      season: 1,
      text: 'Gear costs 1 less.',
      effect: { kind: 'cheap-gear', amount: 1 },
    };
    state.gearDiscountsLeft = 0;
    expect(gearCost(state, state.gearRow[0])).toBe(state.gearRow[0].cost - 1);
  });

  it('lets a Season of Chance claim the unseen top of the deck', () => {
    const state = baseGame(74);
    state.seasonCard = {
      id: 'chance',
      name: 'Season of Chance',
      season: 1,
      text: 'Claim the top of the deck.',
      effect: { kind: 'chance' },
    };
    state.players[0].resources = { sun: 9, water: 9, forest: 9, mountain: 9, wild: 0 };
    const top = state.parkDeck[0];
    expect(canClaimChance(state, 0)).toBe(true);

    let next = arriveAtEnd(state);
    next = applyAction(next, { type: 'trail-end', option: 'chance-park' });
    expect(next.players[0].parks.map((p) => p.id)).toContain(top.id);
    expect(next.parkDeck[0].id).not.toBe(top.id);
  });
});

describe('Nightfall expansion', () => {
  it('starts everyone with a wildcard and lets one cover two resources', () => {
    const state = createGame({ seed: 81, expansions: { nightfall: true, wildlife: false } });
    expect(state.players.every((p) => (p.resources.wild ?? 0) === 1)).toBe(true);
    expect(wildCoverage(state)).toBe(2);

    // A park needing two resources is payable with a single wildcard.
    const park = state.parkRow.find((p) => bagTotal(p.cost) >= 2)!;
    const player = state.players[0];
    player.resources = { sun: 0, water: 0, forest: 0, mountain: 0, wild: 1 };
    const cost = effectiveCost(player, park, state);
    const plan = planPayment(player, cost, wildCoverage(state));
    if (bagTotal(cost) <= 2) {
      expect(plan).not.toBeNull();
      expect(plan!.wild).toBe(1);
    }
  });

  it('is off without the expansion', () => {
    const state = baseGame(82);
    expect(state.players.every((p) => (p.resources.wild ?? 0) === 0)).toBe(true);
    expect(wildCoverage(state)).toBe(1);
    expect(state.tentSites).toHaveLength(0);
    expect(state.campsites).toHaveLength(0);
  });

  it('pitches tents before the Trail End and every other site back', () => {
    const state = createGame({ seed: 83, expansions: { nightfall: true, wildlife: false } });
    const end = state.trail.length - 1;
    expect(state.tentSites).toContain(end - 1);
    expect(state.tentSites).not.toContain(end - 2);
    expect(state.tentSites).toContain(end - 3);
    expect(state.tentSites.every((i) => i >= 1 && i < end)).toBe(true);
  });

  it('offers the site action or a campsite, and camping skips the site', () => {
    const state = createGame({ seed: 84, expansions: { nightfall: true, wildlife: false } });
    const index = state.tentSites[state.tentSites.length - 1];
    state.trail[index] = 'valley';
    state.siteTokens[index] = null;
    state.seasonCard = null;
    state.campsites = [{ id: 'stargazing', tents: [] }];
    state.current = 0;
    state.players[0].resources = { sun: 0, water: 0, forest: 0, mountain: 0, wild: 0 };

    const arrived = applyAction(state, { type: 'move', hikerId: 'p0h0', to: index });
    expect(arrived.pending?.kind).toBe('tent');

    // Taking the site action pays the Valley's two water.
    const tookSite = applyAction(arrived, { type: 'tent', option: 'site' });
    expect(tookSite.players[0].resources.water).toBe(2);
    expect(tookSite.pending).toBeNull();

    // Camping instead pays the campsite and leaves the site's water behind.
    const camped = applyAction(arrived, { type: 'tent', option: 'camp', campsiteId: 'stargazing' });
    expect(camped.players[0].resources.water).toBe(0);
    expect(camped.players[0].resources.wild).toBe(1);
    expect(camped.campsites[0].tents).toEqual([0]);
  });

  it('fills campsite slots and frees them at the season break', () => {
    let state = createGame({ seed: 85, expansions: { nightfall: true, wildlife: false } });
    state.campsites = [{ id: 'stargazing', tents: [1, 2] }];
    // Two tents is the cap at four players, so the campsite is closed.
    expect(openCampsites(state)).toHaveLength(0);

    state.phase = 'season-end';
    state = applyAction(state, { type: 'end-season' });
    expect(state.campsites[0].tents).toEqual([]);
    expect(openCampsites(state)).toHaveLength(1);
  });

  it('runs the Alpine Bivouac trade only when it can be paid', () => {
    const state = createGame({ seed: 86, expansions: { nightfall: true, wildlife: false } });
    const index = state.tentSites[0];
    state.campsites = [{ id: 'alpine-bivouac', tents: [] }];
    state.seasonCard = null;
    state.siteTokens[index] = null;
    state.current = 0;
    state.players[0].resources = { sun: 0, water: 0, forest: 0, mountain: 1, wild: 0 };

    let next = applyAction(state, { type: 'move', hikerId: 'p0h0', to: index });
    next = applyAction(next, { type: 'tent', option: 'camp', campsiteId: 'alpine-bivouac' });
    expect(next.players[0].resources.mountain).toBe(0);
    expect(next.players[0].resources.sun).toBe(5);
  });
});

describe('Wildlife expansion', () => {
  it('puts the bison on the park row and moves it on when its park is visited', () => {
    const state = createGame({ seed: 91, expansions: { nightfall: false, wildlife: true } });
    expect(state.bison).toBe(0);
    const park = bisonPark(state)!;
    state.players[0].resources = { sun: 9, water: 9, forest: 9, mountain: 9, wild: 0 };

    let next = arriveAtEnd(state);
    next = applyAction(next, { type: 'trail-end', option: 'claim-park', parkId: park.id });
    // Claiming the bison's park offers its trade before the turn ends.
    expect(next.pending?.kind).toBe('bison');

    const traded = applyAction(next, { type: 'bison', give: 'sun' });
    expect(traded.players[0].resources.wild).toBe(1);
    expect(traded.bison).toBe(1);
    expect(traded.pending).toBeNull();

    const declined = applyAction(next, { type: 'bison' });
    expect(declined.players[0].resources.wild).toBe(0);
    expect(declined.bison).toBe(1);
  });

  it('refreshes a gear card when the bison loops back around', () => {
    const state = createGame({ seed: 92, expansions: { nightfall: false, wildlife: true } });
    state.bison = state.parkRow.length - 1;
    const park = bisonPark(state)!;
    const gearBefore = state.gearRow[0].id;
    state.players[0].resources = { sun: 9, water: 9, forest: 9, mountain: 9, wild: 0 };

    let next = arriveAtEnd(state);
    next = applyAction(next, { type: 'trail-end', option: 'claim-park', parkId: park.id });
    next = applyAction(next, { type: 'bison' });
    expect(next.bison).toBe(0);
    expect(next.gearRow[0].id).not.toBe(gearBefore);
  });

  it('adds its four advanced sites to the pool and none without the expansion', () => {
    const withWildlife = new Set<string>();
    for (let seed = 1; seed <= 25; seed++) {
      const state = createGame({ seed, expansions: { nightfall: false, wildlife: true } });
      for (const kind of state.advancedOrder) withWildlife.add(kind);
    }
    expect(WILDLIFE_SITES.some((k) => withWildlife.has(k))).toBe(true);

    for (let seed = 1; seed <= 10; seed++) {
      const state = baseGame(seed);
      expect(state.advancedOrder.some((k) => WILDLIFE_SITES.includes(k))).toBe(false);
    }
  });

  it('Memory Cliffs trades a photo for one of each resource', () => {
    const state = createGame({ seed: 93, expansions: { nightfall: false, wildlife: true } });
    const index = putSite(state, 'adv-memory');
    state.current = 0;
    state.players[0].photos = 1;
    state.players[0].resources = { sun: 0, water: 0, forest: 0, mountain: 0, wild: 0 };

    const next = applyAction(state, { type: 'move', hikerId: 'p0h0', to: index });
    expect(next.players[0].photos).toBe(0);
    expect(next.players[0].resources).toMatchObject({ sun: 1, water: 1, forest: 1, mountain: 1 });

    // With no photo to give up, the stop simply passes.
    state.players[0].photos = 0;
    const empty = applyAction(state, { type: 'move', hikerId: 'p0h0', to: index });
    expect(empty.players[0].resources.sun).toBe(0);
  });

  it('Fire Lookout pays a sun per hiker ahead, and Bison Meadow moves the bison', () => {
    const state = createGame({ seed: 94, expansions: { nightfall: false, wildlife: true } });
    const lookout = putSite(state, 'adv-lookout', 1);
    state.players[1].hikers[0].position = lookout + 1;
    state.players[2].hikers[0].position = lookout + 2;
    state.current = 0;
    state.players[0].resources = { sun: 0, water: 0, forest: 0, mountain: 0, wild: 0 };
    const spotted = applyAction(state, { type: 'move', hikerId: 'p0h0', to: lookout });
    expect(spotted.players[0].resources.sun).toBe(2);

    const meadow = createGame({ seed: 94, expansions: { nightfall: false, wildlife: true } });
    const index = putSite(meadow, 'adv-bison');
    meadow.current = 0;
    meadow.bison = 0;
    meadow.players[0].resources = { sun: 2, water: 0, forest: 0, mountain: 0, wild: 0 };
    const next = applyAction(meadow, { type: 'move', hikerId: 'p0h0', to: index });
    // The trade costs a resource and the bison walks on.
    expect(next.players[0].resources.wild).toBe(1);
    expect(next.players[0].resources.sun).toBe(1);
    expect(next.bison).toBe(1);
  });

  it('Ranger Talk reserves the top park card unseen', () => {
    const state = createGame({ seed: 95, expansions: { nightfall: false, wildlife: true } });
    const index = putSite(state, 'adv-talk');
    state.current = 0;
    const top = state.parkDeck[0];
    const next = applyAction(state, { type: 'move', hikerId: 'p0h0', to: index });
    expect(next.players[0].reserved.map((p) => p.id)).toContain(top.id);
    expect(next.firstPlayer).toBe(0);
  });
});

describe('full games driven by the CPU logic', () => {
  it('finishes four seasons and scores every player', () => {
    for (const seed of [1, 2, 3, 5, 8, 13, 21, 34]) {
      const state = playOut(seed);
      expect(state.season).toBe(SEASONS);
      expect(state.phase).toBe('game-over');
      expect(state.finalScores).toHaveLength(4);
      for (const score of state.finalScores!) {
        expect(score.total).toBe(
          score.parkVp +
            score.photoVp +
            score.gearVp +
            score.bonusVp +
            score.firstPlayerVp +
            score.leftoverVp,
        );
        expect(score.total).toBeGreaterThan(0);
      }
      expect(state.finalScores!.filter((s) => s.firstPlayerVp > 0)).toHaveLength(1);
      const parksClaimed = state.players.reduce((sum, p) => sum + p.parks.length, 0);
      expect(parksClaimed, `seed ${seed} claimed ${parksClaimed} parks`).toBeGreaterThanOrEqual(4);
      expect(state.players.every((p) => p.hikers.every((h) => h.finished))).toBe(true);
    }
  });

  it('never spends resources or campfires it does not have', () => {
    const state = playOut(4);
    expect(state.players.every((p) => p.campfires >= 0)).toBe(true);
    expect(
      state.players.every((p) => Object.values(p.resources).every((v) => (v ?? 0) >= 0)),
    ).toBe(true);
    expect(state.players.filter((p) => p.index === state.cameraHolder).length).toBeLessThanOrEqual(1);
  });
});
