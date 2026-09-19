import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import { keys, TABLE_TTL_SECONDS, upstashKv, type Kv } from './kv';
import { act, createTable, joinTable, readState, startTable } from './table';
import { legalMoves } from '../game/engine';

/**
 * The Upstash REST client has to talk to a real HTTP endpoint to be worth
 * anything, and the deployment is the first place that ever happens. This
 * stands a small server in its place that answers the way Upstash documents:
 * one command per POST as a JSON array, `{"result": …}` or `{"error": …}` back.
 *
 * It is not Redis — the compare-and-set script's Lua only ever runs on the real
 * thing — but it does pin down every wire-level assumption the client makes:
 * the command shapes, the bearer token, EX expiries, MGET's array, and that a
 * losing compare-and-set comes back as -1 rather than as an error.
 */
interface Entry {
  value: string;
  expiresAt: number | null;
}

const TOKEN = 'test-token';
let store: Map<string, Entry>;
let server: Server;
let base: string;
/** Every command the client sent, for asserting the exact wire shapes. */
let sent: unknown[][];

function get(key: string): string | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

function set(key: string, value: string, ttlSeconds?: number): void {
  store.set(key, { value, expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null });
}

/** The semantics of the client's one Lua script, applied to this store. */
function compareAndSet(command: unknown[]): number {
  const [, script, numKeys, stateKey, versionKey, expected, state, ttl] = command as [
    string,
    string,
    number,
    string,
    string,
    string,
    string,
    string,
  ];
  expect(script).toContain("redis.call('GET', KEYS[2])");
  expect(numKeys).toBe(2);
  const held = Number(get(versionKey) ?? '0');
  if (held !== Number(expected)) return -1;
  const next = held + 1;
  set(stateKey, state, Number(ttl));
  set(versionKey, String(next), Number(ttl));
  return next;
}

function run(command: unknown[]): unknown {
  const [name, ...rest] = command as [string, ...string[]];
  switch (name) {
    case 'GET':
      return get(rest[0]);
    case 'MGET':
      return rest.map((key) => get(key));
    case 'SET': {
      const [key, value, ex, seconds] = rest;
      expect(ex === undefined || ex === 'EX').toBe(true);
      set(key, value, seconds ? Number(seconds) : undefined);
      return 'OK';
    }
    case 'INCR': {
      const next = Number(get(rest[0]) ?? '0') + 1;
      const held = store.get(rest[0]);
      store.set(rest[0], { value: String(next), expiresAt: held?.expiresAt ?? null });
      return next;
    }
    case 'EVAL':
      return compareAndSet(command);
    default:
      throw new Error(`unexpected command ${name}`);
  }
}

beforeAll(async () => {
  store = new Map();
  sent = [];
  server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => {
      const answer = (status: number, body: unknown) => {
        response.writeHead(status, { 'content-type': 'application/json' });
        response.end(JSON.stringify(body));
      };
      if (request.headers.authorization !== `Bearer ${TOKEN}`) {
        answer(401, { error: 'unauthorized' });
        return;
      }
      let command: unknown[];
      try {
        command = JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown[];
      } catch {
        answer(400, { error: 'bad request' });
        return;
      }
      sent.push(command);
      try {
        answer(200, { result: run(command) });
      } catch (error) {
        answer(200, { error: error instanceof Error ? error.message : 'error' });
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  store.clear();
  sent = [];
});

const kv = (): Kv => upstashKv(base, TOKEN);

describe('the Upstash REST client', () => {
  it('sends one command per request, as a JSON array with a bearer token', async () => {
    await kv().set('a', 'one');
    expect(await kv().get('a')).toBe('one');
    expect(await kv().get('missing')).toBeNull();
    expect(sent).toEqual([
      ['SET', 'a', 'one'],
      ['GET', 'a'],
      ['GET', 'missing'],
    ]);
  });

  it('passes an expiry as EX seconds', async () => {
    await kv().set('b', 'two', 90);
    expect(sent.at(-1)).toEqual(['SET', 'b', 'two', 'EX', 90]);
    expect(store.get('b')?.expiresAt).toBeGreaterThan(Date.now());
  });

  it('reads a whole seat row in one MGET, holes included', async () => {
    await kv().set('s0', 'zero');
    await kv().set('s2', 'two');
    expect(await kv().mget(['s0', 's1', 's2'])).toEqual(['zero', null, 'two']);
    expect(sent.at(-1)).toEqual(['MGET', 's0', 's1', 's2']);
    // An empty read is not worth a round trip.
    expect(await kv().mget([])).toEqual([]);
    expect(sent).toHaveLength(3);
  });

  it('counts up with INCR', async () => {
    expect(await kv().incr('v')).toBe(1);
    expect(await kv().incr('v')).toBe(2);
    expect(sent.at(-1)).toEqual(['INCR', 'v']);
  });

  it('writes the state and the version together, and refuses a stale write', async () => {
    const prefix = keys.table('ABCDE');
    await kv().set(`${prefix}:version`, '0');

    const first = await kv().casState(prefix, 0, '{"phase":"playing"}', TABLE_TTL_SECONDS);
    expect(first).toBe(1);
    expect(store.get(`${prefix}:state`)?.value).toBe('{"phase":"playing"}');
    expect(store.get(`${prefix}:version`)?.value).toBe('1');
    // Both keys carry the table's expiry, so an abandoned game cleans itself up.
    expect(store.get(`${prefix}:state`)?.expiresAt).toBeGreaterThan(Date.now());

    // A second writer holding the old version is turned away, not obeyed.
    expect(await kv().casState(prefix, 0, '{"phase":"clobbered"}', TABLE_TTL_SECONDS)).toBeNull();
    expect(store.get(`${prefix}:state`)?.value).toBe('{"phase":"playing"}');
    expect(await kv().casState(prefix, 1, '{"phase":"next"}', TABLE_TTL_SECONDS)).toBe(2);
  });

  it('reports a bad token rather than pretending the write worked', async () => {
    await expect(upstashKv(base, 'wrong').get('a')).rejects.toThrow(/redis 401/);
  });
});

describe('a whole table over the REST client', () => {
  it('deals, seats, starts and plays a turn against the store', async () => {
    const redis = kv();
    const created = await createTable(redis, {
      seats: 3,
      expansions: { nightfall: true, wildlife: true },
    });
    const code = created.lobby.code;

    await joinTable(redis, { code, seat: 0, token: created.seatTokens[0].token, name: 'Clem' });
    const started = await startTable(redis, { code, hostToken: created.hostToken });
    expect(started.lobby?.seats.map((s) => s.kind)).toEqual(['human', 'cpu', 'cpu']);
    expect(started.view!.current).toBe(0);

    const move = legalMoves(started.view!)[0];
    const played = await act(redis, {
      code,
      seat: 0,
      token: created.seatTokens[0].token,
      action: { type: 'move', hikerId: move.hikerId, to: move.to, useCampfire: move.useCampfire },
    });
    expect(played.version).toBeGreaterThan(started.version);
    expect(played.view!.log.some((entry) => entry.player === 0)).toBe(true);

    // A phone polling with the version it holds gets one number back.
    const quiet = await readState(redis, {
      code,
      seat: 0,
      token: created.seatTokens[0].token,
      since: played.version,
    });
    expect(quiet).toEqual({ version: played.version });

    // And the whole game sits under this table's keys, nowhere else.
    expect([...store.keys()].every((key) => key.startsWith(`table:${code}`))).toBe(true);
  });
});
