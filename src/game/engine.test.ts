import { describe, expect, it } from 'vitest';
import {
  applyAction,
  canteensAvailable,
  claimableParks,
  createGame,
  legalMoves,
  occupants,
  SEASONS,
} from './engine';
import { aiAction } from './ai';
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
  for (let step = 0; step < 4000; step++) {
    if (state.phase === 'game-over') return state;
    const action = aiAction(state);
    expect(action, `no action available at step ${step}`).not.toBeNull();
    const before = JSON.stringify(state);
    state = applyAction(state, action!);
    const after = JSON.stringify(state);
    if (before === after && state.phase === 'playing') {
      throw new Error(`AI action made no progress: ${JSON.stringify(action)}`);
    }
  }
  throw new Error('game did not finish within the step budget');
}

describe('setup', () => {
  it('gives every player two hikers, one canteen and two bonus cards', () => {
    const state = createGame({ seed: 42 });
    expect(state.players).toHaveLength(4);
    for (const player of state.players) {
      expect(player.hikers).toHaveLength(2);
      expect(player.hikers.every((h) => h.position === 0)).toBe(true);
      expect(player.canteens.total).toBe(1);
      expect(canteensAvailable(player)).toBe(1);
      expect(player.bonusCards).toHaveLength(2);
    }
    expect(new Set(state.players.flatMap((p) => p.bonusCards)).size).toBe(8);
    expect(state.players[0].isHuman).toBe(true);
    expect(state.players.filter((p) => !p.isHuman)).toHaveLength(3);
  });

  it('builds a trail that grows each season and always has a campfire', () => {
    let state = createGame({ seed: 7 });
    const lengths: number[] = [];
    for (let season = 1; season <= SEASONS; season++) {
      lengths.push(state.trail.length);
      expect(state.trail[0]).toBe('trailhead');
      expect(state.trail[state.trail.length - 1]).toBe('trail-end');
      expect(state.trail).toContain('campfire');
      state.phase = 'season-end';
      if (season < SEASONS) state = applyAction(state, { type: 'end-season' });
    }
    expect(lengths).toEqual([8, 9, 10, 11]);
  });

  it('always includes a campfire and a reservation desk', () => {
    for (let seed = 1; seed <= 120; seed++) {
      let state = createGame({ seed });
      for (let season = 1; season <= SEASONS; season++) {
        expect(state.trail, `seed ${seed} season ${season}`).toContain('campfire');
        expect(state.trail, `seed ${seed} season ${season}`).toContain('reservation');
        state.phase = 'season-end';
        if (season < SEASONS) state = applyAction(state, { type: 'end-season' });
      }
    }
  });

  it('is deterministic for a given seed', () => {
    expect(JSON.stringify(createGame({ seed: 99 }).trail)).toBe(
      JSON.stringify(createGame({ seed: 99 }).trail),
    );
  });
});

describe('occupancy', () => {
  it('blocks a second hiker on a site unless a campfire is spent', () => {
    const state = createGame({ seed: 11 });
    const target = 3;
    state.players[1].hikers[0].position = target;
    state.current = 0;

    const withoutFire = legalMoves(state).filter((m) => m.to === target);
    expect(withoutFire).toHaveLength(0);

    state.players[0].campfires = 1;
    const withFire = legalMoves(state).filter((m) => m.to === target);
    expect(withFire.length).toBeGreaterThan(0);
    expect(withFire.every((m) => m.useCampfire)).toBe(true);

    const next = applyAction(state, { type: 'move', hikerId: 'p0h0', to: target, useCampfire: true });
    expect(next.players[0].campfires).toBe(0);
    expect(occupants(next, target)).toHaveLength(2);
  });

  it('lets the Trail End hold every hiker', () => {
    const state = createGame({ seed: 13 });
    const end = state.trail.length - 1;
    for (const player of state.players) {
      for (const hiker of player.hikers) hiker.position = end;
    }
    state.players[0].hikers[0].position = 1;
    state.current = 0;
    expect(legalMoves(state).some((m) => m.to === end && !m.useCampfire)).toBe(true);
  });

  it('honors the Trail Map gear which waives the campfire requirement', () => {
    const state = createGame({ seed: 17 });
    state.players[0].gear.push({
      id: 'trail-map',
      name: 'Trail Map',
      icon: 'map',
      cost: 5,
      text: '',
      effect: { kind: 'ignore-occupancy' },
    });
    state.players[1].hikers[0].position = 2;
    state.current = 0;
    const shared = legalMoves(state).filter((m) => m.to === 2);
    expect(shared.length).toBeGreaterThan(0);
    expect(shared.every((m) => !m.useCampfire)).toBe(true);
  });
});

describe('resources and parks', () => {
  it('clears sun but keeps other resources between seasons', () => {
    let state = createGame({ seed: 21 });
    state.players[0].resources = { sun: 4, water: 2, forest: 1, mountain: 0, animal: 3 };
    state.players[0].canteens.used = 1;
    state.phase = 'season-end';
    state = applyAction(state, { type: 'end-season' });
    expect(state.players[0].resources.sun).toBe(0);
    expect(state.players[0].resources.water).toBe(2);
    expect(state.players[0].resources.animal).toBe(3);
    expect(canteensAvailable(state.players[0])).toBe(1);
    expect(state.season).toBe(2);
    expect(state.firstPlayer).toBe(1);
  });

  it('pays for a park with resources and a canteen as the wild', () => {
    const state = createGame({ seed: 31 });
    const park = state.parkRow[0];
    const player = state.players[0];
    // Give exact cost minus one, so the canteen has to cover the gap.
    const cost = { ...park.cost };
    const keys = Object.keys(cost) as (keyof typeof cost)[];
    player.resources = { sun: 0, water: 0, forest: 0, mountain: 0, animal: 0 };
    for (const k of keys) player.resources[k] = (cost[k] ?? 0);
    player.resources[keys[0]] = (player.resources[keys[0]] ?? 0) - 1;

    expect(claimableParks(state, 0).some((p) => p.id === park.id)).toBe(true);
    const end = state.trail.length - 1;
    state.current = 0;
    let next = applyAction(state, { type: 'move', hikerId: 'p0h0', to: end });
    expect(next.pending?.kind).toBe('trail-end');
    next = applyAction(next, { type: 'trail-end', option: 'claim-park', parkId: park.id });
    expect(next.players[0].parks.map((p) => p.id)).toContain(park.id);
    expect(canteensAvailable(next.players[0])).toBe(0);
    expect(next.parkRow.some((p) => p.id === park.id)).toBe(false);
  });

  it('refuses a park the player cannot pay for', () => {
    const state = createGame({ seed: 33 });
    state.players[0].resources = { sun: 0, water: 0, forest: 0, mountain: 0, animal: 0 };
    state.players[0].canteens.used = 1;
    expect(claimableParks(state, 0)).toHaveLength(0);
  });

  it('keeps a reserved park out of everyone else reach', () => {
    const state = createGame({ seed: 37 });
    const park = state.parkRow[1];
    state.players[1].reserved.push(park);
    state.players[0].resources = { sun: 9, water: 9, forest: 9, mountain: 9, animal: 9 };
    expect(claimableParks(state, 0).some((p) => p.id === park.id)).toBe(false);
    state.players[1].resources = { sun: 9, water: 9, forest: 9, mountain: 9, animal: 9 };
    expect(claimableParks(state, 1).some((p) => p.id === park.id)).toBe(true);
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
        expect(score.total).toBe(score.parkVp + score.photoVp + score.bonusVp + score.leftoverVp);
        expect(score.total).toBeGreaterThan(0);
      }
      // Opportunistic play should actually visit parks.
      const parksClaimed = state.players.reduce((sum, p) => sum + p.parks.length, 0);
      expect(parksClaimed, `seed ${seed} claimed ${parksClaimed} parks`).toBeGreaterThanOrEqual(4);
      // No hiker may sit on an occupied single-capacity site at the end.
      expect(state.players.every((p) => p.hikers.every((h) => h.finished))).toBe(true);
    }
  });

  it('never lets a CPU spend a campfire it does not have', () => {
    const state = playOut(4);
    expect(state.players.every((p) => p.campfires >= 0)).toBe(true);
    expect(
      state.players.every((p) => Object.values(p.resources).every((v) => (v ?? 0) >= 0)),
    ).toBe(true);
  });
});
