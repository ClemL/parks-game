import { describe, expect, it } from 'vitest';
import {
  affordableGear,
  applyAction,
  claimableParks,
  createGame,
  legalMoves,
  photoCost,
  reservableParks,
} from '../game/engine';
import { aiAction } from '../game/ai';
import type { GameAction, GameState } from '../game/types';

/** Deliberately simple opponent: always step to the nearest open site, claim the
 *  best affordable park at the end. Maximizes the number of turns taken. */
function baselineAction(state: GameState): GameAction {
  if (state.pending) {
    const p = state.pending;
    if (p.stage === 'take-photo') return { type: 'camera-photo', take: true };
    if (p.kind === 'camera') return { type: 'camera', option: 'take-camera' };
    const player = state.players[p.player];
    const best = [...claimableParks(state, p.player)].sort((a, b) => b.vp - a.vp)[0];
    if (best) return { type: 'trail-end', option: 'claim-park', parkId: best.id };
    const reserve = [...reservableParks(state)].sort((a, b) => b.vp - a.vp)[0];
    if (reserve && state.season < 4) {
      return { type: 'trail-end', option: 'reserve-park', parkId: reserve.id };
    }
    const gear = affordableGear(state, p.player)[0];
    if (gear) return { type: 'trail-end', option: 'buy-gear', gearId: gear.id };
    if ((player.resources.sun ?? 0) >= photoCost(state, p.player)) {
      return { type: 'trail-end', option: 'photo' };
    }
    return { type: 'trail-end', option: 'rest' };
  }
  const moves = legalMoves(state).filter((m) => !m.useCampfire);
  const pool = moves.length > 0 ? moves : legalMoves(state);
  const nearest = pool.reduce((a, b) => (b.to < a.to ? b : a));
  return { type: 'move', hikerId: nearest.hikerId, to: nearest.to, useCampfire: nearest.useCampfire };
}

interface Summary {
  score: number[];
  parks: number[];
  moves: number[];
}

function run(baselineSeats: number[], games = 40): Summary {
  const totals = [0, 0, 0, 0];
  const parks = [0, 0, 0, 0];
  const wins = [0, 0, 0, 0];
  const turns = [0, 0, 0, 0];
  const photos = [0, 0, 0, 0];
  for (let seed = 1; seed <= games; seed++) {
    let state: GameState = createGame({ seed });
    for (const p of state.players) p.isHuman = false;
    state.players[0].personality = 'collector';
    for (let i = 0; i < 8000 && state.phase !== 'game-over'; i++) {
      if (state.phase === 'season-end') {
        state = applyAction(state, { type: 'end-season' });
        continue;
      }
      const seat = state.current;
      const action = baselineSeats.includes(seat) ? baselineAction(state) : aiAction(state)!;
      if (action.type === 'move') turns[seat] += 1;
      state = applyAction(state, action);
    }
    for (const s of state.finalScores!) {
      totals[s.player] += s.total;
      parks[s.player] += state.players[s.player].parks.length;
      photos[s.player] += state.players[s.player].photos;
    }
    wins[state.finalScores![0].player] += 1;
  }
  const label = ['seat0', 'Ada', 'Bo', 'Cy'];
  for (let i = 0; i < 4; i++) {
    console.log(
      `${(baselineSeats.includes(i) ? `BASE-${label[i]}` : label[i]).padEnd(11)} score=${(totals[i] / games).toFixed(1)} parks=${(parks[i] / games).toFixed(2)} moves=${(turns[i] / games).toFixed(1)} photos=${(photos[i] / games).toFixed(2)} wins=${wins[i]}`,
    );
  }
  return {
    score: totals.map((t) => t / games),
    parks: parks.map((t) => t / games),
    moves: turns.map((t) => t / games),
  };
}

describe('AI vs shortest-step baseline', () => {
  it('keeps up with a tempo-optimal opponent', () => {
    const baselineSeats = [0, 2];
    const summary = run(baselineSeats);
    const bestBaseline = Math.max(...baselineSeats.map((i) => summary.score[i]));
    const bestAi = Math.max(...[1, 3].map((i) => summary.score[i]));
    // The CPUs must not be dominated by simply always stepping to the next open site.
    expect(bestAi).toBeGreaterThan(bestBaseline * 0.92);
    // And they must still claim parks at a healthy rate.
    expect(Math.min(summary.parks[1], summary.parks[3])).toBeGreaterThan(4);
  });
});
