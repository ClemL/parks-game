import { describe, expect, it } from 'vitest';
import {
  applyAction,
  campfireAllowance,
  claimableParks,
  copyableSites,
  createGame,
  legalMoves,
  occupants,
  PARK_ROW_SIZE,
  photoCost,
  reservableParks,
  SEASONS,
  siteDef,
  tokenCount,
  usableBottles,
} from './engine';
import { aiAction } from './ai';
import {
  ADVANCED_SITES,
  BASIC_SITES,
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
    expect(state.parkRow).toHaveLength(PARK_ROW_SIZE);
    expect(PARK_ROW_SIZE).toBe(3);
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
        for (const basic of BASIC_SITES) {
          expect(middle.filter((k) => k === basic), `${basic} in season ${season}`).toHaveLength(1);
        }
        // Exactly `season` advanced sites, all different, in a stable order.
        const advanced = middle.filter((k) => ADVANCED_SITES.includes(k));
        expect(advanced).toHaveLength(season);
        expect(new Set(advanced).size).toBe(season);
        expect(new Set(advanced)).toEqual(new Set(state.advancedOrder.slice(0, season)));

        state.phase = 'season-end';
        if (season < SEASONS) state = applyAction(state, { type: 'end-season' });
      }
      expect(lengths).toEqual([9, 10, 11, 12]);
      // By winter all four advanced sites are in play.
      expect(new Set(state.trail.filter((k) => ADVANCED_SITES.includes(k))).size).toBe(4);
    }
  });

  it('is deterministic for a given seed', () => {
    expect(JSON.stringify(createGame({ seed: 99 }))).toBe(JSON.stringify(createGame({ seed: 99 })));
  });
});

describe('season tokens', () => {
  it('puts one sun or water token on every site except the trailhead and the end', () => {
    const state = createGame({ seed: 5 });
    expect(state.siteTokens[0]).toBeNull();
    expect(state.siteTokens[state.trail.length - 1]).toBeNull();
    const middle = state.siteTokens.slice(1, -1);
    expect(middle).toHaveLength(state.trail.length - 2);
    expect(middle.every((t) => t === 'sun' || t === 'water')).toBe(true);
  });

  it('gives the token to the first hiker there and to nobody after', () => {
    const state = createGame({ seed: 5 });
    // Pick a plain resource site so only its own payout and the token apply.
    const target = state.trail.findIndex((k) => k === 'forest' || k === 'mountain');
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
    expect(state.siteTokens.slice(1, -1).every((t) => t !== null)).toBe(true);
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
    const index = state.trail.indexOf('camera');
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
    state.players[0].resources.sun = 0;
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
  function landOn(kind: string, seed = 61, setup?: (s: GameState) => void) {
    let state = createGame({ seed });
    // Walk seasons forward until the site is on the trail.
    let guard = 0;
    while (!state.trail.includes(kind as never) && guard++ < 4) {
      state.phase = 'season-end';
      state = applyAction(state, { type: 'end-season' });
    }
    expect(state.trail).toContain(kind as never);
    const index = state.trail.indexOf(kind as never);
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
    let state = createGame({ seed: 63 });
    let guard = 0;
    while (!(state.trail.includes('adv-copy') && state.trail.includes('adv-park')) && guard++ < 4) {
      state.phase = 'season-end';
      state = applyAction(state, { type: 'end-season' });
    }
    expect(state.trail).toContain('adv-copy');
    expect(state.trail).toContain('adv-park');

    const overlook = state.trail.indexOf('adv-copy');
    const station = state.trail.indexOf('adv-park');
    state.players[1].hikers[0].position = station;
    state.siteTokens[overlook] = null;
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
    let state = createGame({ seed: 62 });
    let guard = 0;
    while (!state.trail.includes('adv-copy') && guard++ < 4) {
      state.phase = 'season-end';
      state = applyAction(state, { type: 'end-season' });
    }
    const overlook = state.trail.indexOf('adv-copy');
    const valley = state.trail.indexOf('valley');
    // An opponent is standing on the Valley, so its action can be copied.
    state.players[1].hikers[0].position = valley;
    state.siteTokens[valley] = null;
    // Clear the Overlook's own season token so only the copy pays out here.
    state.siteTokens[overlook] = null;
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
    let state = createGame({ seed: 62 });
    let guard = 0;
    while (!state.trail.includes('adv-copy') && guard++ < 4) {
      state.phase = 'season-end';
      state = applyAction(state, { type: 'end-season' });
    }
    const overlook = state.trail.indexOf('adv-copy');
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
    const state = createGame({ seed: 46 });
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
    const index = state.trail.indexOf('valley');
    state.current = 0;
    state.players[0].resources = { sun: 5, water: 3, forest: 3, mountain: 1, wild: 1 };
    const next = applyAction(state, { type: 'move', hikerId: 'p0h0', to: index });
    expect(tokenCount(next.players[0])).toBe(TOKEN_LIMIT);
    // Sun is shed before anything else, and wildcards are kept.
    expect(next.players[0].resources.wild).toBe(1);
    expect(next.players[0].resources.sun).toBeLessThan(5);
  });

  it('pays for a photo with a wildcard when sun runs short', () => {
    const state = createGame({ seed: 54 });
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

describe('full games driven by the CPU logic', () => {
  it('finishes four seasons and scores every player', () => {
    for (const seed of [1, 2, 3, 5, 8, 13, 21, 34]) {
      const state = playOut(seed);
      expect(state.season).toBe(SEASONS);
      expect(state.phase).toBe('game-over');
      expect(state.finalScores).toHaveLength(4);
      for (const score of state.finalScores!) {
        expect(score.total).toBe(
          score.parkVp + score.photoVp + score.bonusVp + score.firstPlayerVp + score.leftoverVp,
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
