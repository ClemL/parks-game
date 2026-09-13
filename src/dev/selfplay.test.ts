import { describe, expect, it } from 'vitest';
import { applyAction, createGame } from '../game/engine';
import { aiAction } from '../game/ai';
import type { GameState } from '../game/types';

describe('self-play statistics', () => {
  it('keeps the park deck deep enough for four seasons', () => {
    const totals = [0, 0, 0, 0];
    const parks = [0, 0, 0, 0];
    const photos = [0, 0, 0, 0];
    const gear = [0, 0, 0, 0];
    const wins = [0, 0, 0, 0];
    let emptyRow = 0;
    let deckLeft = 0;
    const games = 40;
    for (let seed = 1; seed <= games; seed++) {
      let state: GameState = createGame({ seed });
      state.players[0].isHuman = false;
      state.players[0].personality = 'collector';
      for (let i = 0; i < 6000 && state.phase !== 'game-over'; i++) {
        const a = aiAction(state);
        if (!a) throw new Error('stuck');
        state = applyAction(state, a);
      }
      for (const s of state.finalScores!) {
        totals[s.player] += s.total;
        parks[s.player] += state.players[s.player].parks.length;
        photos[s.player] += state.players[s.player].photos;
        gear[s.player] += state.players[s.player].gear.length;
      }
      wins[state.finalScores![0].player] += 1;
      emptyRow += state.parkRow.length === 0 ? 1 : 0;
      deckLeft += state.parkDeck.length;
    }
    console.log(`games with empty park row: ${emptyRow}/${games}; avg park deck left: ${(deckLeft / games).toFixed(1)}`);
    expect(emptyRow).toBe(0);
    const names = ['collector(P0)', 'Ada/collector', 'Bo/photographer', 'Cy/blazer'];
    for (let i = 0; i < 4; i++) {
      console.log(
        `${names[i].padEnd(18)} avgScore=${(totals[i] / games).toFixed(1)} parks=${(parks[i] / games).toFixed(2)} photos=${(photos[i] / games).toFixed(2)} gear=${(gear[i] / games).toFixed(2)} wins=${wins[i]}`,
      );
    }
  });
});
