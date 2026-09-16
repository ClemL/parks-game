import type { ExpansionFlags, GameAction } from '../game/types';
import type { GameView } from '../game/view';

/** How a seat is filled. An open seat becomes a CPU when the game starts. */
export type SeatKind = 'open' | 'human' | 'cpu';

/** A seat as the table is allowed to show it: no tokens. */
export interface PublicSeat {
  seat: number;
  name: string;
  kind: SeatKind;
}

export interface Lobby {
  code: string;
  started: boolean;
  seats: PublicSeat[];
}

/** What the table device keeps to itself after creating a table. */
export interface CreatedTable {
  lobby: Lobby;
  hostToken: string;
  /** Per-seat secrets, which the table turns into one QR code each. */
  seatTokens: { seat: number; token: string }[];
}

export interface StateResponse {
  version: number;
  /** Absent when the caller's `since` already matched: nothing has changed. */
  lobby?: Lobby;
  /** Absent before the game starts, and on an unchanged poll. */
  view?: GameView;
}

export interface CreateRequest {
  seats: number;
  expansions: ExpansionFlags;
}

export interface JoinRequest {
  code: string;
  seat: number;
  token: string;
  name?: string;
}

export interface StartRequest {
  code: string;
  hostToken: string;
}

export interface ActRequest {
  code: string;
  /** The seat the action is for. The table may act for any seat. */
  seat: number;
  /** That seat's token, or the host's. */
  token: string;
  action: GameAction;
}

/** Every route answers with this shape on failure. */
export interface ErrorResponse {
  error: string;
}

export const POLL_MS = { active: 1200, idle: 3000 } as const;
