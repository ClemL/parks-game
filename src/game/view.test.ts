import { describe, expect, it } from 'vitest';
import { applyAction, createGame, hydrate, legalMoves } from './engine';
import { aiAction } from './ai';
import { HIDDEN_BONUS, parkDeckLeft, reservedCount, viewFor } from './view';
import type { GameState } from './types';

/** Plays until a predicate holds, so tests can look at a mid-game state. */
function playUntil(state: GameState, done: (s: GameState) => boolean, limit = 4000): GameState {
  let current = { ...state };
  current.players[0].isHuman = false;
  current.players[0].personality = 'collector';
  for (let i = 0; i < limit && !done(current) && current.phase !== 'game-over'; i++) {
    const action = aiAction(current);
    if (!action) break;
    current = applyAction(current, action);
  }
  return current;
}

describe('per-seat views', () => {
  it('hides the park deck and the rng cursor from every seat', () => {
    const state = createGame({ seed: 5 });
    for (const seat of [0, 1, 2, 3, null]) {
      const view = viewFor(state, seat);
      expect(view.parkDeck).toEqual([]);
      expect(view.gearDeck).toEqual([]);
      expect(view.bottleDeck).toEqual([]);
      expect(view.rng).toBe(0);
      // The count survives, since the board shows how deep the deck is.
      expect(parkDeckLeft(view)).toBe(state.parkDeck.length);
      expect(parkDeckLeft(view)).toBeGreaterThan(40);
    }
  });

  it('shows you your own bonus cards and nobody else their', () => {
    const state = createGame({ seed: 5 });
    const view = viewFor(state, 2);
    expect(view.players[2].bonusCards).toEqual(state.players[2].bonusCards);
    expect(view.players[2].bonusCards[0]).not.toBe(HIDDEN_BONUS);
    for (const other of [0, 1, 3]) {
      expect(view.players[other].bonusCards).toEqual([HIDDEN_BONUS, HIDDEN_BONUS]);
      // The count is still right, so the board can show two face-down cards.
      expect(view.players[other].bonusCards).toHaveLength(state.players[other].bonusCards.length);
    }
  });

  it('keeps every bonus card off the public table view', () => {
    const state = createGame({ seed: 5 });
    const table = viewFor(state, null);
    for (const player of table.players) {
      expect(player.bonusCards.every((c) => c === HIDDEN_BONUS)).toBe(true);
    }
  });

  it('hides which parks another seat has reserved, but not how many', () => {
    const start = createGame({ seed: 11 });
    const state = playUntil(start, (s) => s.players.some((p) => p.reserved.length > 0));
    const owner = state.players.findIndex((p) => p.reserved.length > 0);
    expect(owner).toBeGreaterThanOrEqual(0);

    const mine = viewFor(state, owner);
    expect(mine.players[owner].reserved).toEqual(state.players[owner].reserved);

    const theirs = viewFor(state, (owner + 1) % state.players.length);
    expect(theirs.players[owner].reserved).toEqual([]);
    expect(reservedCount(theirs, owner)).toBe(state.players[owner].reserved.length);
    // A reserved park leaves the shared row, so hiding it cannot confuse the
    // board about what is still on offer.
    expect(theirs.parkRow.some((p) => p.id === state.players[owner].reserved[0].id)).toBe(false);
  });

  it('reveals everything once the game is scored', () => {
    const state = playUntil(createGame({ seed: 7 }), () => false);
    expect(state.phase).toBe('game-over');
    const view = viewFor(state, 1);
    for (const player of state.players) {
      expect(view.players[player.index].bonusCards).toEqual(player.bonusCards);
      expect(view.players[player.index].reserved).toEqual(player.reserved);
    }
    // The deck stays face down even then: it is nobody's score.
    expect(view.parkDeck).toEqual([]);
  });

  it('never hands back a reference into the authoritative state', () => {
    const state = createGame({ seed: 3 });
    const view = viewFor(state, 0);
    view.players[0].resources.sun = 99;
    const trailLength = state.trail.length;
    view.trail.push('forest');
    expect(state.players[0].resources.sun).not.toBe(99);
    expect(state.trail).toHaveLength(trailLength);
  });
});

describe('older saves', () => {
  it('fills in the fresh-water counter a previous build never wrote', () => {
    const state = createGame({ seed: 8 });
    // A game stored before flasks cared where the water came from.
    const stored = JSON.parse(JSON.stringify(state)) as GameState;
    for (const player of stored.players) delete (player as Partial<typeof player>).waterThisTurn;

    const revived = hydrate(stored);
    expect(revived.players.every((p) => p.waterThisTurn === 0)).toBe(true);
    // And it plays on rather than turning the counter into NaN.
    const moves = legalMoves(revived);
    const next = applyAction(revived, {
      type: 'move',
      hikerId: moves[0].hikerId,
      to: moves[0].to,
      useCampfire: moves[0].useCampfire,
    });
    expect(Number.isFinite(next.players[0].waterThisTurn)).toBe(true);
  });
});
