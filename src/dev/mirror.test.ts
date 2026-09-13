import { describe, expect, it } from 'vitest';
import { applyAction, createGame } from '../game/engine';
import { aiAction } from '../game/ai';
import type { AiPersonality, GameState } from '../game/types';

function mirror(p: AiPersonality, games = 30): number {
  let total = 0;
  for (let seed = 1; seed <= games; seed++) {
    let state: GameState = createGame({ seed });
    for (const pl of state.players) {
      pl.isHuman = false;
      pl.personality = p;
    }
    for (let i = 0; i < 6000 && state.phase !== 'game-over'; i++) {
      state = applyAction(state, aiAction(state)!);
    }
    total += state.finalScores!.reduce((s, x) => s + x.total, 0) / 4;
  }
  return total / games;
}

describe('mirror matches', () => {
  it('keeps the three CPU styles within a comparable strength band', () => {
    const results = (['collector', 'photographer', 'blazer'] as AiPersonality[]).map((p) => {
      const score = mirror(p);
      console.log(`${p.padEnd(14)} avg table score = ${score.toFixed(1)}`);
      return score;
    });
    const low = Math.min(...results);
    const high = Math.max(...results);
    expect(high / low).toBeLessThan(1.2);
    expect(low).toBeGreaterThan(25);
  });
});
