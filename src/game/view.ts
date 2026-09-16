import type { GameState } from './types';
import { clone } from './engine/primitives';

/**
 * What a redacted view dropped, so the board can still show counts for cards it
 * is no longer allowed to name.
 */
export interface RedactedInfo {
  /** Cards left in the park deck, whose order the view no longer carries. */
  parkDeckCount: number;
  /** Parks each seat has reserved, for the seats whose cards are hidden. */
  reservedCount: number[];
  /** The seat this view belongs to, or null for the table's public view. */
  seat: number | null;
}

/** A game state with another player's secrets taken out of it. */
export type GameView = GameState & { redacted: RedactedInfo };

/** Stand-in for a bonus card you are not allowed to read. */
export const HIDDEN_BONUS = 'hidden';

/**
 * Builds the state a single device is allowed to see.
 *
 * Everything a player could gain by reading somebody else's screen comes out:
 * the park deck's order, the RNG cursor that would predict it, the other seats'
 * bonus cards and the parks they have reserved out of the row. The counts stay,
 * because the board has to keep showing "59 in the deck" and "Ada holds 2
 * reservations". Once the game is over, the scoreboard reveals everything, so
 * only the deck is still withheld.
 *
 * `seat` is the player this view is for; `null` builds the table's public view,
 * which holds no secrets at all.
 */
export function viewFor(state: GameState, seat: number | null): GameView {
  const view = clone(state) as GameView;
  const over = state.phase === 'game-over';

  view.redacted = {
    parkDeckCount: state.parkDeck.length,
    reservedCount: state.players.map((p) => p.reserved.length),
    seat,
  };

  // The deck's order, and the cursor that would predict every future draw.
  view.parkDeck = [];
  view.gearDeck = [];
  view.bottleDeck = [];
  view.rng = 0;

  for (const player of view.players) {
    if (over || player.index === seat) continue;
    player.bonusCards = player.bonusCards.map(() => HIDDEN_BONUS);
    player.reserved = [];
  }

  return view;
}

/** Cards left in the park deck, whether the state is a full one or a view. */
export function parkDeckLeft(state: GameState): number {
  const redacted = (state as GameView).redacted;
  return redacted ? redacted.parkDeckCount : state.parkDeck.length;
}

/** How many parks a seat has reserved, counting the ones a view cannot name. */
export function reservedCount(state: GameState, seat: number): number {
  const redacted = (state as GameView).redacted;
  return redacted ? redacted.reservedCount[seat] : state.players[seat].reserved.length;
}
