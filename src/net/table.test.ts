import { beforeEach, describe, expect, it } from 'vitest';
import { act, createTable, joinTable, mayAct, readState, startTable, TableError } from './table';
import { kvFromEnv, memoryKv, multiplayerOff, type Kv } from './kv';
import { handle } from './routes';
import { legalMoves } from '../game/engine';
import { HIDDEN_BONUS } from '../game/view';
import type { GameView } from '../game/view';
import type { CreatedTable } from './protocol';
import type { GameAction } from '../game/types';

const expansions = { nightfall: true, wildlife: true };

let kv: Kv;
beforeEach(() => {
  kv = memoryKv();
});

async function table(seats = 4): Promise<CreatedTable> {
  return createTable(kv, { seats, expansions });
}

/** The view a seat currently holds, asking for it from scratch. */
async function seatView(code: string, seat: number, token: string): Promise<GameView> {
  const response = await readState(kv, { code, seat, token });
  if (!response.view) throw new Error('no view');
  return response.view;
}

describe('table lifecycle', () => {
  it('opens a lobby with one token per seat', async () => {
    const created = await table(4);
    expect(created.lobby.code).toMatch(/^[A-HJ-NP-Z2-9]{5}$/);
    expect(created.lobby.started).toBe(false);
    expect(created.lobby.seats).toHaveLength(4);
    expect(created.lobby.seats.every((s) => s.kind === 'open')).toBe(true);
    expect(created.seatTokens).toHaveLength(4);
    // Each seat's secret is its own, and none of them is the host's.
    const tokens = new Set([...created.seatTokens.map((s) => s.token), created.hostToken]);
    expect(tokens.size).toBe(5);
    // And no token ever appears in what the table is allowed to show.
    expect(JSON.stringify(created.lobby)).not.toContain(created.seatTokens[0].token);
  });

  it('claims a seat from its own token only', async () => {
    const created = await table();
    const seat = created.seatTokens[1];
    const lobby = await joinTable(kv, { code: created.lobby.code, seat: 1, token: seat.token, name: 'Kris' });
    expect(lobby.seats[1]).toEqual({ seat: 1, name: 'Kris', kind: 'human' });
    expect(lobby.seats[0].kind).toBe('open');

    await expect(
      joinTable(kv, { code: created.lobby.code, seat: 2, token: seat.token, name: 'thief' }),
    ).rejects.toThrow(TableError);
    await expect(joinTable(kv, { code: 'ZZZZZ', seat: 0, token: seat.token })).rejects.toThrow(/no table/);
  });

  it('fills the empty chairs with CPUs on start, and only the host may start', async () => {
    const created = await table(4);
    const code = created.lobby.code;
    await joinTable(kv, { code, seat: 0, token: created.seatTokens[0].token, name: 'Clem' });
    await joinTable(kv, { code, seat: 2, token: created.seatTokens[2].token, name: 'Srini' });

    await expect(startTable(kv, { code, hostToken: 'wrong' })).rejects.toThrow(/not this table/);
    const started = await startTable(kv, { code, hostToken: created.hostToken });

    expect(started.lobby?.started).toBe(true);
    expect(started.lobby?.seats.map((s) => s.kind)).toEqual(['human', 'cpu', 'human', 'cpu']);
    const players = started.view!.players;
    expect(players.map((p) => p.isHuman)).toEqual([true, false, true, false]);
    expect(players[0].name).toBe('Clem');
    expect(players[2].name).toBe('Srini');
    // Two CPUs, two different names and playing styles.
    expect(new Set([players[1].name, players[3].name]).size).toBe(2);
    expect(players[1].personality).toBeDefined();
    expect(players[0].personality).toBeUndefined();

    await expect(startTable(kv, { code, hostToken: created.hostToken })).rejects.toThrow(/already started/);
  });

  it('runs the CPU seats ahead of the first human without being asked', async () => {
    const created = await table(4);
    const code = created.lobby.code;
    // Only seat 2 is human, so seats 0 and 1 must have played already.
    await joinTable(kv, { code, seat: 2, token: created.seatTokens[2].token, name: 'Kris' });
    const started = await startTable(kv, { code, hostToken: created.hostToken });
    expect(started.view!.current).toBe(2);
    expect(started.view!.log.length).toBeGreaterThan(0);
  });
});

describe('table authority', () => {
  it('refuses an action from a seat that is not on the clock', async () => {
    const created = await table(3);
    const code = created.lobby.code;
    for (const seat of [0, 1, 2]) {
      await joinTable(kv, { code, seat, token: created.seatTokens[seat].token, name: `P${seat}` });
    }
    const started = await startTable(kv, { code, hostToken: created.hostToken });
    const state = started.view!;
    expect(state.current).toBe(0);

    const move = legalMoves(state)[0];
    const action: GameAction = { type: 'move', hikerId: move.hikerId, to: move.to };

    // Seat 1 holds a real token, but it is not its turn.
    await expect(
      act(kv, { code, seat: 1, token: created.seatTokens[1].token, action }),
    ).rejects.toThrow(/turn/);
    // Seat 0's turn, but with seat 1's token.
    await expect(
      act(kv, { code, seat: 0, token: created.seatTokens[1].token, action }),
    ).rejects.toThrow(/another device/);

    const played = await act(kv, { code, seat: 0, token: created.seatTokens[0].token, action });
    expect(played.view!.log.some((entry) => entry.player === 0)).toBe(true);
  });

  it('lets the table play a seat whose phone has died', async () => {
    const created = await table(2);
    const code = created.lobby.code;
    await joinTable(kv, { code, seat: 0, token: created.seatTokens[0].token, name: 'Clem' });
    await joinTable(kv, { code, seat: 1, token: created.seatTokens[1].token, name: 'Kris' });
    const started = await startTable(kv, { code, hostToken: created.hostToken });

    const move = legalMoves(started.view!)[0];
    const played = await act(kv, {
      code,
      seat: 0,
      token: created.hostToken,
      action: { type: 'move', hikerId: move.hikerId, to: move.to },
    });
    expect(played.version).toBeGreaterThan(started.version);
  });

  it('only allows a pending decision to be answered by its own seat', async () => {
    const created = await table(2);
    const code = created.lobby.code;
    await joinTable(kv, { code, seat: 0, token: created.seatTokens[0].token });
    await joinTable(kv, { code, seat: 1, token: created.seatTokens[1].token });
    const started = await startTable(kv, { code, hostToken: created.hostToken });
    const state = started.view!;

    // Walking to the Trail End always opens a decision.
    const end = state.trail.length - 1;
    const toEnd = legalMoves(state).find((m) => m.to === end)!;
    const after = await act(kv, {
      code,
      seat: 0,
      token: created.seatTokens[0].token,
      action: { type: 'move', hikerId: toEnd.hikerId, to: end },
    });
    expect(after.view!.pending?.player).toBe(0);

    await expect(
      act(kv, { code, seat: 1, token: created.seatTokens[1].token, action: { type: 'trail-end', option: 'rest' } }),
    ).rejects.toThrow(/turn/);
    const resolved = await act(kv, {
      code,
      seat: 0,
      token: created.seatTokens[0].token,
      action: { type: 'trail-end', option: 'rest' },
    });
    expect(resolved.view!.pending).toBeNull();
  });

  it('gates every action kind through mayAct', async () => {
    const created = await table(2);
    const code = created.lobby.code;
    await joinTable(kv, { code, seat: 0, token: created.seatTokens[0].token });
    const state = (await startTable(kv, { code, hostToken: created.hostToken })).view!;

    expect(mayAct(state, 0, { type: 'move', hikerId: 'p0h0', to: 1 })).toBe(true);
    expect(mayAct(state, 0, { type: 'use-bottle', bottleId: 'p0b0' })).toBe(true);
    // A site decision cannot be sent out of the blue to skip a move.
    expect(mayAct(state, 0, { type: 'camera', option: 'take-camera' })).toBe(false);
    expect(mayAct(state, 1, { type: 'move', hikerId: 'p1h0', to: 1 })).toBe(false);
    expect(mayAct({ ...state, phase: 'game-over' }, 0, { type: 'move', hikerId: 'p0h0', to: 1 })).toBe(false);
    expect(mayAct({ ...state, phase: 'season-end' }, 0, { type: 'end-season' })).toBe(true);
    expect(mayAct(state, 0, { type: 'end-season' })).toBe(false);
  });
});

describe('the routes', () => {
  it('takes the seat token from an Authorization header, not the URL', async () => {
    const created = await table(2);
    const code = created.lobby.code;
    const seatToken = created.seatTokens[1].token;

    const withHeader = await handle(kv, {
      method: 'GET',
      route: 'state',
      query: { code, seat: '1' },
      headers: { authorization: `Bearer ${seatToken}` },
      body: {},
    });
    expect(withHeader.status).toBe(200);

    // No token anywhere, and the seat is refused.
    const bare = await handle(kv, {
      method: 'GET',
      route: 'state',
      query: { code, seat: '1' },
      body: {},
    });
    expect(bare.status).toBe(403);

    // A wrong route is a 404, not a crash.
    expect((await handle(kv, { method: 'GET', route: 'nope', query: {}, body: {} })).status).toBe(404);
    // And a table error keeps its own status rather than becoming a 500.
    expect(
      (await handle(kv, { method: 'GET', route: 'state', query: { code: 'ZZZZZ' }, body: {} })).status,
    ).toBe(404);
  });
});

describe('what each device is told', () => {
  it('gives a phone its own secrets and nobody else theirs', async () => {
    const created = await table(3);
    const code = created.lobby.code;
    for (const seat of [0, 1]) {
      await joinTable(kv, { code, seat, token: created.seatTokens[seat].token, name: `P${seat}` });
    }
    await startTable(kv, { code, hostToken: created.hostToken });

    const mine = await seatView(code, 1, created.seatTokens[1].token);
    expect(mine.players[1].bonusCards).not.toContain(HIDDEN_BONUS);
    expect(mine.players[0].bonusCards.every((c) => c === HIDDEN_BONUS)).toBe(true);
    expect(mine.parkDeck).toEqual([]);
    expect(mine.rng).toBe(0);
    expect(mine.redacted.seat).toBe(1);

    // The table itself holds no secrets at all.
    const shared = await readState(kv, { code, seat: null, token: created.hostToken });
    expect(shared.view!.players.every((p) => p.bonusCards.every((c) => c === HIDDEN_BONUS))).toBe(true);
    expect(shared.view!.redacted.seat).toBeNull();
  });

  it('answers an unchanged poll with one number', async () => {
    const created = await table(2);
    const code = created.lobby.code;
    const first = await readState(kv, { code, seat: null, token: created.hostToken });
    const again = await readState(kv, { code, seat: null, token: created.hostToken, since: first.version });
    expect(again).toEqual({ version: first.version });
    expect(again.view).toBeUndefined();
    expect(again.lobby).toBeUndefined();
  });

  it('bumps the version when a seat joins, so the table notices', async () => {
    const created = await table(2);
    const code = created.lobby.code;
    const before = await readState(kv, { code, seat: null, token: created.hostToken });
    await joinTable(kv, { code, seat: 1, token: created.seatTokens[1].token, name: 'Kris' });
    const after = await readState(kv, { code, seat: null, token: created.hostToken, since: before.version });
    expect(after.version).toBeGreaterThan(before.version);
    expect(after.lobby!.seats[1].name).toBe('Kris');
  });

  it('will not hand a view to a device with the wrong token', async () => {
    const created = await table(2);
    const code = created.lobby.code;
    await expect(readState(kv, { code, seat: 0, token: 'nope' })).rejects.toThrow(/another device/);
    await expect(readState(kv, { code, seat: null, token: 'nope' })).rejects.toThrow(/not this table/);
    await expect(readState(kv, { code: 'ZZZZZ', seat: null })).rejects.toThrow(/no table/);
  });
});

describe('the store it picks', () => {
  it('shares one in-process store between routes when there is no Redis', () => {
    const a = kvFromEnv({});
    const b = kvFromEnv({});
    expect(a).toBe(b);
    expect(multiplayerOff({})).toBeNull();
  });

  it('switches table mode off on a deployment with no Redis behind it', () => {
    // Never throws: a missing store must not take a build or a page down.
    expect(kvFromEnv({ VERCEL: '1' })).toBeNull();
    expect(multiplayerOff({ VERCEL: '1' })).toMatch(/UPSTASH_REDIS_REST_URL/);
    // Either variable pair brings it back.
    for (const env of [
      { VERCEL: '1', UPSTASH_REDIS_REST_URL: 'u', UPSTASH_REDIS_REST_TOKEN: 't' },
      { VERCEL: '1', KV_REST_API_URL: 'u', KV_REST_API_TOKEN: 't' },
    ]) {
      expect(kvFromEnv(env)).not.toBeNull();
      expect(multiplayerOff(env)).toBeNull();
    }
  });

  it('reports itself through /api/health, and declines the rest politely', async () => {
    const on = await handle(kv, { method: 'GET', route: 'health', query: {}, body: {} });
    expect(on).toEqual({ status: 200, body: { multiplayer: true } });

    const reason = multiplayerOff({ VERCEL: '1' })!;
    const off = await handle(null, { method: 'GET', route: 'health', query: {}, body: {} }, reason);
    expect(off.status).toBe(200);
    expect(off.body).toEqual({ multiplayer: false, reason });

    // Every other route says the same thing rather than blowing up.
    const refused = await handle(
      null,
      { method: 'POST', route: 'table', query: {}, body: { seats: 4, expansions } },
      reason,
    );
    expect(refused.status).toBe(503);
    expect(refused.body).toEqual({ multiplayer: false, error: reason });
  });
});
