import { describe, expect, it } from 'vitest';
import {
  applyAction,
  claimableParks,
  createGame,
  legalMoves,
  occupants,
  photoCost,
  reservableParks,
  SEASONS,
  usableBottles,
} from './engine';
import { aiAction } from './ai';
import { PHOTO_COST, PHOTO_COST_DISCOUNTED } from './data/sites';
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
  });

  it('builds a trail that grows each season and always has a camera point', () => {
    let state = createGame({ seed: 7 });
    const lengths: number[] = [];
    for (let season = 1; season <= SEASONS; season++) {
      lengths.push(state.trail.length);
      expect(state.trail[0]).toBe('trailhead');
      expect(state.trail[state.trail.length - 1]).toBe('trail-end');
      expect(state.trail).toContain('camera');
      // Removed locations stay removed.
      expect(state.trail).not.toContain('vista');
      expect(state.trail).not.toContain('campfire');
      expect(state.trail).not.toContain('reservation');
      state.phase = 'season-end';
      if (season < SEASONS) state = applyAction(state, { type: 'end-season' });
    }
    expect(lengths).toEqual([8, 9, 10, 11]);
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
    const target = 2;
    const token = state.siteTokens[target]!;
    state.current = 0;

    const first = applyAction(state, { type: 'move', hikerId: 'p0h0', to: target });
    expect(first.players[0].resources[token]).toBe(
      (state.players[0].resources[token] ?? 0) + (first.trail[target] === token ? 2 : 1),
    );
    expect(first.siteTokens[target]).toBeNull();

    // A second hiker sharing the site with a campfire gets the site, not the token.
    first.current = 1;
    const before = first.players[1].resources[token] ?? 0;
    const second = applyAction(first, { type: 'move', hikerId: 'p1h0', to: target, useCampfire: true });
    const siteAlsoPays = second.trail[target] === token ? 1 : 0;
    expect(second.players[1].resources[token] ?? 0).toBe(before + siteAlsoPays);
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

  it('refills every bottle at the season break and at a Spring', () => {
    let state = createGame({ seed: 33 });
    state.players[0].bottles = [{ id: 'b', kind: 'pine-flask', used: true }];
    state.phase = 'season-end';
    state = applyAction(state, { type: 'end-season' });
    expect(state.players[0].bottles[0].used).toBe(false);

    const spring = createGame({ seed: 34 });
    const index = spring.trail.indexOf('spring');
    if (index > 0) {
      spring.players[0].bottles = [{ id: 'b', kind: 'pine-flask', used: true }];
      spring.current = 0;
      const next = applyAction(spring, { type: 'move', hikerId: 'p0h0', to: index });
      expect(next.players[0].bottles[0].used).toBe(false);
    }
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

  it('discounts the first gear purchase of each season only', () => {
    const state = createGame({ seed: 43 });
    const card = state.gearRow[0];
    state.players[0].resources.sun = 9;
    state.players[1].resources.sun = 9;

    let next = arriveAtEnd(state);
    next = applyAction(next, { type: 'trail-end', option: 'buy-gear', gearId: card.id });
    expect(next.players[0].gear.map((g) => g.id)).toContain(card.id);
    expect(next.players[0].resources.sun).toBe(9 - (card.cost - 1));
    expect(next.gearDiscountAvailable).toBe(false);

    const second = next.gearRow[0];
    next.current = 1;
    let other = applyAction(next, { type: 'move', hikerId: 'p1h0', to: next.trail.length - 1 });
    other = applyAction(other, { type: 'trail-end', option: 'buy-gear', gearId: second.id });
    expect(other.players[1].resources.sun).toBe(9 - second.cost);
  });

  it('offers the discount again in the next season', () => {
    let state = createGame({ seed: 44 });
    state.gearDiscountAvailable = false;
    state.phase = 'season-end';
    state = applyAction(state, { type: 'end-season' });
    expect(state.gearDiscountAvailable).toBe(true);
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
  it('clears sun but keeps everything else between seasons', () => {
    let state = createGame({ seed: 51 });
    state.players[0].resources = { sun: 4, water: 2, forest: 1, mountain: 0, wild: 3 };
    state.phase = 'season-end';
    state = applyAction(state, { type: 'end-season' });
    expect(state.players[0].resources.sun).toBe(0);
    expect(state.players[0].resources.water).toBe(2);
    expect(state.players[0].resources.wild).toBe(3);
    expect(state.season).toBe(2);
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
