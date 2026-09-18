import { applyAction, createGame, CPU_SEATS, hydrate } from '../game/engine';
import { aiAction } from '../game/ai';
import { MAX_PLAYERS, MIN_PLAYERS } from '../game/data/sites';
import { viewFor, type GameView } from '../game/view';
import type { ExpansionFlags, GameAction, GameState } from '../game/types';
import { keys, TABLE_TTL_SECONDS, type Kv } from './kv';
import type {
  ActRequest,
  CreatedTable,
  CreateRequest,
  JoinRequest,
  Lobby,
  PublicSeat,
  SeatKind,
  StartRequest,
  StateResponse,
} from './protocol';

/** Thrown for anything the caller could fix: bad code, wrong seat, not its turn. */
export class TableError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

/** Table codes are read off a screen and typed by hand, so no I/O/0/1. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 5;

interface TableRecord {
  code: string;
  hostToken: string;
  seatCount: number;
  expansions: ExpansionFlags;
  /** Kept server-side for the whole game: it would predict every future draw. */
  seed: number;
  createdAt: number;
}

interface SeatRecord {
  token: string;
  name: string;
  kind: SeatKind;
}

const seatKey = (code: string, seat: number) => `${keys.table(code)}:seat:${seat}`;

function secret(): string {
  return crypto.randomUUID().replace(/-/g, '');
}

function code(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

async function readTable(kv: Kv, tableCode: string): Promise<TableRecord> {
  const raw = await kv.get(keys.table(tableCode));
  if (!raw) throw new TableError('no table with that code', 404);
  return JSON.parse(raw) as TableRecord;
}

async function readSeats(kv: Kv, table: TableRecord): Promise<SeatRecord[]> {
  const raw = await kv.mget(
    Array.from({ length: table.seatCount }, (_, seat) => seatKey(table.code, seat)),
  );
  return raw.map((entry, seat) =>
    entry ? (JSON.parse(entry) as SeatRecord) : { token: '', name: seatName(seat), kind: 'open' },
  );
}

function seatName(seat: number): string {
  return seat === 0 ? 'Seat 1' : `Seat ${seat + 1}`;
}

function publicSeats(seats: SeatRecord[]): PublicSeat[] {
  return seats.map((seat, index) => ({ seat: index, name: seat.name, kind: seat.kind }));
}

async function lobbyOf(kv: Kv, table: TableRecord, started: boolean): Promise<Lobby> {
  return { code: table.code, started, seats: publicSeats(await readSeats(kv, table)) };
}

/** Opens a table in its lobby: seats with tokens, no game yet. */
export async function createTable(kv: Kv, request: CreateRequest): Promise<CreatedTable> {
  const seatCount = Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, Math.round(request.seats)));

  let tableCode = code();
  for (let attempt = 0; attempt < 5 && (await kv.get(keys.table(tableCode))); attempt++) {
    tableCode = code();
  }

  const table: TableRecord = {
    code: tableCode,
    hostToken: secret(),
    seatCount,
    expansions: request.expansions,
    seed: Math.floor(Math.random() * 0x7fffffff),
    createdAt: Date.now(),
  };
  await kv.set(keys.table(tableCode), JSON.stringify(table), TABLE_TTL_SECONDS);
  await kv.set(keys.version(tableCode), '0', TABLE_TTL_SECONDS);

  // Each seat gets its own key and its own secret, so two people scanning at
  // once cannot overwrite each other.
  const seatTokens: { seat: number; token: string }[] = [];
  for (let seat = 0; seat < seatCount; seat++) {
    const token = secret();
    seatTokens.push({ seat, token });
    const record: SeatRecord = { token, name: seatName(seat), kind: 'open' };
    await kv.set(seatKey(tableCode, seat), JSON.stringify(record), TABLE_TTL_SECONDS);
  }

  return {
    lobby: { code: tableCode, started: false, seats: publicSeats(await readSeats(kv, table)) },
    hostToken: table.hostToken,
    seatTokens,
  };
}

/** A phone claiming its seat from the QR code. */
export async function joinTable(kv: Kv, request: JoinRequest): Promise<Lobby> {
  const table = await readTable(kv, request.code);
  const seats = await readSeats(kv, table);
  const seat = seats[request.seat];
  if (!seat) throw new TableError('no such seat', 404);
  if (seat.token !== request.token) throw new TableError('that seat belongs to another device', 403);

  const name = (request.name ?? '').trim().slice(0, 16) || seat.name;
  const claimed: SeatRecord = { ...seat, name, kind: 'human' };
  await kv.set(seatKey(table.code, request.seat), JSON.stringify(claimed), TABLE_TTL_SECONDS);
  await kv.incr(keys.version(table.code));

  seats[request.seat] = claimed;
  return {
    code: table.code,
    started: (await kv.get(keys.state(table.code))) !== null,
    seats: publicSeats(seats),
  };
}

/** Deals the board. Seats nobody claimed play themselves. */
export async function startTable(kv: Kv, request: StartRequest): Promise<StateResponse> {
  const table = await readTable(kv, request.code);
  if (table.hostToken !== request.hostToken) throw new TableError('not this table', 403);
  if (await kv.get(keys.state(table.code))) throw new TableError('already started', 409);

  const seats = await readSeats(kv, table);
  let state = createGame({ seed: table.seed, expansions: table.expansions, players: table.seatCount });

  let cpus = 0;
  for (const [index, seat] of seats.entries()) {
    const player = state.players[index];
    if (seat.kind === 'human') {
      player.isHuman = true;
      player.name = seat.name;
      delete player.personality;
    } else {
      // An empty chair keeps its seat colour and takes the name and playing
      // style of the next stock opponent, so no two CPUs share a name.
      const stock = CPU_SEATS[cpus++ % CPU_SEATS.length];
      player.isHuman = false;
      player.name = stock.name;
      player.personality = stock.personality;
      const record: SeatRecord = { ...seat, name: stock.name, kind: 'cpu' };
      await kv.set(seatKey(table.code, index), JSON.stringify(record), TABLE_TTL_SECONDS);
    }
  }

  state = runCpuTurns(state);
  // Every join has already bumped the version, so start from the one on record.
  const held = Number((await kv.get(keys.version(table.code))) ?? '0');
  const version = await write(kv, table.code, held, state);
  return { version, lobby: await lobbyOf(kv, table, true), view: viewFor(state, null) };
}

/** Plays out every CPU seat until a human is on the clock again. */
export function runCpuTurns(state: GameState, limit = 400): GameState {
  let current = state;
  for (let i = 0; i < limit; i++) {
    if (current.phase !== 'playing') break;
    if (current.players[current.current].isHuman) break;
    const action = aiAction(current);
    if (!action) break;
    current = applyAction(current, action);
  }
  return current;
}

/**
 * Whether a seat is allowed to send this action. A pending decision belongs to
 * one seat; otherwise the seat on the clock moves. Everything else is refused,
 * which is what stops a phone playing somebody else's turn.
 */
export function mayAct(state: GameState, seat: number, action: GameAction): boolean {
  if (state.phase === 'game-over') return false;
  if (state.phase === 'season-end') return action.type === 'end-season';
  if (action.type === 'end-season') return false;
  if (state.pending) return state.pending.player === seat;
  if (state.current !== seat) return false;
  return action.type === 'move' || action.type === 'use-bottle';
}

async function write(kv: Kv, tableCode: string, version: number, state: GameState): Promise<number> {
  const next = await kv.casState(keys.table(tableCode), version, JSON.stringify(state), TABLE_TTL_SECONDS);
  if (next === null) throw new TableError('the table moved on, reload', 409);
  return next;
}

/**
 * Applies one action on behalf of a seat, then lets the CPUs answer. The table's
 * own token may act for any seat, which is how a game carries on when somebody's
 * phone goes flat.
 */
export async function act(kv: Kv, request: ActRequest): Promise<StateResponse> {
  const table = await readTable(kv, request.code);
  const seats = await readSeats(kv, table);
  const seat = seats[request.seat];
  if (!seat) throw new TableError('no such seat', 404);
  if (seat.token !== request.token && table.hostToken !== request.token) {
    throw new TableError('that seat belongs to another device', 403);
  }

  // Version first, then state: the other order could pair a stale state with a
  // fresh version, and the compare-and-set would wave it through.
  const version = Number((await kv.get(keys.version(table.code))) ?? '0');
  const raw = await kv.get(keys.state(table.code));
  if (!raw) throw new TableError('the game has not started', 409);
  const state = hydrate(JSON.parse(raw) as GameState);

  if (!mayAct(state, request.seat, request.action)) {
    throw new TableError('not that seat’s turn', 409);
  }

  const applied = runCpuTurns(applyAction(state, request.action));
  const next = await write(kv, table.code, version, applied);
  return { version: next, view: viewFor(applied, request.seat) };
}

/**
 * The polling endpoint. `since` is the version the caller already holds; when it
 * still matches, the answer is one number and one Redis read.
 */
export async function readState(
  kv: Kv,
  request: { code: string; seat: number | null; token?: string; since?: number },
): Promise<StateResponse> {
  const version = Number((await kv.get(keys.version(request.code))) ?? '-1');
  if (version < 0) throw new TableError('no table with that code', 404);
  if (request.since !== undefined && request.since === version) return { version };

  const table = await readTable(kv, request.code);
  const seats = await readSeats(kv, table);
  let seat: number | null = null;
  if (request.seat !== null && request.seat >= 0) {
    const record = seats[request.seat];
    if (!record) throw new TableError('no such seat', 404);
    const known = record.token === request.token || table.hostToken === request.token;
    if (!known) throw new TableError('that seat belongs to another device', 403);
    seat = request.seat;
  } else if (request.token && request.token !== table.hostToken) {
    throw new TableError('not this table', 403);
  }

  const raw = await kv.get(keys.state(table.code));
  const view: GameView | undefined = raw
    ? viewFor(hydrate(JSON.parse(raw) as GameState), seat)
    : undefined;
  return {
    version,
    lobby: { code: table.code, started: raw !== null, seats: publicSeats(seats) },
    view,
  };
}
