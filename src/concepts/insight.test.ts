import { describe, expect, it } from 'vitest';
import { createGame, legalMoves } from '../game/engine';
import type { GameState, ParkCard } from '../game/types';
import { contenders, goalParks, lastOwnEntry, parkProgress, previewMove, seasonHaul } from './insight';

/** A base-game table with no season card, so payouts are exactly the sites'. */
function plainGame(): GameState {
  const state = createGame({ seed: 7, players: 4, expansions: { nightfall: false, wildlife: false } });
  state.seasonCard = null;
  state.current = 0;
  return state;
}

const valleyMove = (state: GameState) => {
  const index = state.trail.indexOf('valley');
  const move = legalMoves(state).find((m) => m.to === index);
  if (!move) throw new Error('no legal move to the valley');
  return move;
};

describe('previewMove', () => {
  it('reports what a site pays, season token included, without touching the game', () => {
    const state = plainGame();
    const move = valleyMove(state);
    const token = state.siteTokens[move.to];
    const before = JSON.stringify(state);

    const preview = previewMove(state, move);

    expect(preview.kind).toBe('valley');
    expect(preview.delta.water).toBe(2 + (token === 'water' ? 1 : 0));
    expect(preview.delta.sun ?? 0).toBe(token === 'sun' ? 1 : 0);
    expect(preview.decision).toBeNull();
    expect(preview.passes).toBe(move.to - 1);
    expect(JSON.stringify(state)).toBe(before);
  });

  it('names the parks a move would put within reach', () => {
    const state = plainGame();
    const park: ParkCard = { ...state.parkRow[0], cost: { water: 2 } };
    state.parkRow[0] = park;
    state.players[0].resources = { sun: 0, water: 0, forest: 0, mountain: 0, wild: 0 };

    const preview = previewMove(state, valleyMove(state));

    expect(preview.unlocks.map((p) => p.id)).toContain(park.id);
  });

  it('previews a tent site as taking its own action, and says a campsite was the alternative', () => {
    const state = createGame({ seed: 7, players: 4, expansions: { nightfall: true, wildlife: false } });
    state.seasonCard = null;
    state.current = 0;
    const move = valleyMove(state);
    state.tentSites = [move.to];
    state.campsites = [{ id: 'forest-clearing', tents: [] }];
    const token = state.siteTokens[move.to];

    const preview = previewMove(state, move);

    expect(preview.tent).toBe(true);
    expect(preview.decision).toBeNull();
    expect(preview.delta.water).toBe(2 + (token === 'water' ? 1 : 0));
  });

  it('flags the decision a choice site opens', () => {
    const state = plainGame();
    const index = state.trail.indexOf('camera');
    const move = legalMoves(state).find((m) => m.to === index)!;

    expect(previewMove(state, move).decision).toBe('camera');
  });
});

describe('parkProgress', () => {
  it('pays from matching resources first, then wildcards, and counts the rest as short', () => {
    const state = plainGame();
    const park: ParkCard = { ...state.parkRow[0], cost: { water: 2, mountain: 2 } };
    const player = { ...state.players[0], resources: { water: 1, mountain: 2, wild: 1 } };

    const progress = parkProgress(state, player, park);

    expect(progress.pips.map((p) => p.state)).toEqual(['held', 'wild', 'held', 'held']);
    expect(progress.short).toBe(0);
    expect(progress.ready).toBe(true);
  });

  it('answers for the pack a move would leave, given the change', () => {
    const state = plainGame();
    const park: ParkCard = { ...state.parkRow[0], cost: { forest: 3 } };
    const player = { ...state.players[0], resources: { forest: 1 } };

    expect(parkProgress(state, player, park).short).toBe(2);
    expect(parkProgress(state, player, park, { forest: 2 }).ready).toBe(true);
  });
});

describe('goalParks', () => {
  it('leaves out parks another player has reserved and keeps your own', () => {
    const state = plainGame();
    const [mine, theirs] = state.parkRow;
    state.players[0].reserved = [mine];
    state.players[1].reserved = [theirs];

    const ids = goalParks(state, 0).map((p) => p.id);

    expect(ids).toContain(mine.id);
    expect(ids).not.toContain(theirs.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('contenders', () => {
  it('names every player who can pay for an open park', () => {
    const state = plainGame();
    const park: ParkCard = { ...state.parkRow[0], cost: { water: 2 } };
    state.parkRow[0] = park;
    state.players.forEach((p, i) => (p.resources = { water: i % 2 === 0 ? 2 : 0 }));

    expect(contenders(state, park).map((p) => p.index)).toEqual([0, 2]);
  });

  it('leaves a reserved park to the player holding it', () => {
    const state = plainGame();
    const park: ParkCard = { ...state.parkRow[0], cost: { water: 2 } };
    state.parkRow[0] = park;
    state.players.forEach((p) => (p.resources = { water: 2 }));
    state.players[1].reserved = [park];

    expect(contenders(state, park).map((p) => p.index)).toEqual([1]);
  });
});

describe('seasonHaul', () => {
  it('adds up the park points visited in one season', () => {
    const state = plainGame();
    const [a, b, c] = state.parkRow;
    const player = { ...state.players[0], parks: [a, b, c], claimedInSeason: [1, 2, 2] };

    expect(seasonHaul(player, 1)).toBe(a.vp);
    expect(seasonHaul(player, 2)).toBe(b.vp + c.vp);
    expect(seasonHaul(player, 3)).toBe(0);
  });
});

describe('lastOwnEntry', () => {
  it('finds where a player last acted in the log', () => {
    const state = plainGame();
    state.log = [
      { season: 1, player: -1, text: 'Season 1 begins.' },
      { season: 1, player: 0, text: 'moved to Valley' },
      { season: 1, player: 1, text: 'moved to Ridge' },
    ];

    expect(lastOwnEntry(state, 0)).toBe(1);
    expect(lastOwnEntry(state, 2)).toBe(-1);
  });
});
