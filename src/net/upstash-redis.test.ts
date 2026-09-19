import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import { createConnection, createServer as createTcpServer, type Socket } from 'node:net';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { keys, TABLE_TTL_SECONDS, upstashKv } from './kv';
import { act, createTable, joinTable, startTable } from './table';
import { legalMoves } from '../game/engine';

/**
 * The same client, but against a real Redis rather than a stand-in, so the one
 * piece that only ever runs on the deployment — the compare-and-set script's
 * Lua — is executed for real: its `false or '0'` for a missing key, the number
 * it writes back, the -1 it answers a stale writer with, and the expiries it
 * puts on both keys.
 *
 * An Upstash-shaped HTTP shim sits in front, turning each posted command array
 * into RESP, so the bytes the client sends are the bytes under test.
 *
 * Uses the server REDIS_PORT names when it is set (CI runs one as a service),
 * otherwise spawns its own. Skipped where there is neither.
 */
const external = Number(process.env.REDIS_PORT ?? '') || null;
const redisAvailable = external !== null || spawnSync('redis-server', ['--version']).status === 0;

async function freePort(): Promise<number> {
  const probe = createTcpServer();
  await new Promise<void>((resolve) => probe.listen(0, '127.0.0.1', resolve));
  const address = probe.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  await new Promise<void>((resolve) => probe.close(() => resolve()));
  return port;
}

/** Just enough RESP to speak to Redis without pulling in a client library. */
function resp(command: (string | number)[]): Buffer {
  const parts = command.map((arg) => {
    const value = String(arg);
    return `$${Buffer.byteLength(value)}\r\n${value}\r\n`;
  });
  return Buffer.from(`*${command.length}\r\n${parts.join('')}`);
}

/** Returns the parsed reply and how many bytes it consumed, or null if partial. */
function parse(buffer: Buffer, at = 0): { value: unknown; end: number } | null {
  const lineEnd = buffer.indexOf('\r\n', at);
  if (lineEnd < 0) return null;
  const kind = String.fromCharCode(buffer[at]);
  const head = buffer.toString('utf8', at + 1, lineEnd);
  const after = lineEnd + 2;

  if (kind === '+') return { value: head, end: after };
  if (kind === '-') return { value: new Error(head), end: after };
  if (kind === ':') return { value: Number(head), end: after };
  if (kind === '$') {
    const length = Number(head);
    if (length < 0) return { value: null, end: after };
    if (buffer.length < after + length + 2) return null;
    return { value: buffer.toString('utf8', after, after + length), end: after + length + 2 };
  }
  if (kind === '*') {
    const count = Number(head);
    if (count < 0) return { value: null, end: after };
    const items: unknown[] = [];
    let cursor = after;
    for (let i = 0; i < count; i++) {
      const item = parse(buffer, cursor);
      if (!item) return null;
      items.push(item.value);
      cursor = item.end;
    }
    return { value: items, end: cursor };
  }
  throw new Error(`unparsed reply: ${buffer.toString('utf8', at, at + 40)}`);
}

/** One connection, one command at a time — this is a test, not a pool. */
function redisClient(port: number) {
  let socket: Socket | null = null;
  const connect = async (): Promise<Socket> => {
    if (socket && !socket.destroyed) return socket;
    const pending = createConnection({ port, host: '127.0.0.1' });
    try {
      await new Promise<void>((resolve, reject) => {
        pending.once('connect', resolve);
        pending.once('error', reject);
      });
    } catch (error) {
      // A half-open socket must not be kept, or every retry reuses the failure.
      pending.destroy();
      socket = null;
      throw error;
    }
    socket = pending;
    return socket;
  };

  return {
    async call(command: (string | number)[]): Promise<unknown> {
      const connection = await connect();
      return new Promise((resolve, reject) => {
        let buffer = Buffer.alloc(0);
        const onData = (chunk: Buffer) => {
          buffer = Buffer.concat([buffer, chunk]);
          let reply;
          try {
            reply = parse(buffer);
          } catch (error) {
            cleanup();
            reject(error);
            return;
          }
          if (!reply) return;
          cleanup();
          if (reply.value instanceof Error) reject(reply.value);
          else resolve(reply.value);
        };
        const onError = (error: Error) => {
          cleanup();
          reject(error);
        };
        const cleanup = () => {
          connection.off('data', onData);
          connection.off('error', onError);
        };
        connection.on('data', onData);
        connection.on('error', onError);
        connection.write(resp(command));
      });
    },
    close() {
      socket?.destroy();
      socket = null;
    },
  };
}

const TOKEN = 'rest-token';
let redis: ChildProcess;
let client: ReturnType<typeof redisClient>;
let shim: Server;
let base: string;

beforeAll(async () => {
  if (!redisAvailable) return;
  const port = external ?? (await freePort());
  if (external === null) {
    redis = spawn('redis-server', ['--port', String(port), '--save', '', '--appendonly', 'no'], {
      stdio: 'ignore',
    });
  }
  client = redisClient(port);
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      if ((await client.call(['PING'])) === 'PONG') break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  // The Upstash REST contract: one command per POST, bearer auth, and a body of
  // {"result": …} or {"error": …} either way with a 200.
  shim = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', async () => {
      const answer = (status: number, body: unknown) => {
        response.writeHead(status, { 'content-type': 'application/json' });
        response.end(JSON.stringify(body));
      };
      if (request.headers.authorization !== `Bearer ${TOKEN}`) return answer(401, { error: 'unauthorized' });
      try {
        const command = JSON.parse(Buffer.concat(chunks).toString('utf8')) as (string | number)[];
        answer(200, { result: await client.call(command) });
      } catch (error) {
        answer(200, { error: error instanceof Error ? error.message : 'error' });
      }
    });
  });
  await new Promise<void>((resolve) => shim.listen(0, '127.0.0.1', resolve));
  const address = shim.address();
  base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
}, 20000);

afterAll(async () => {
  if (!redisAvailable) return;
  if (shim) await new Promise<void>((resolve) => shim.close(() => resolve()));
  client?.close();
  redis?.kill();
});

beforeEach(async () => {
  if (redisAvailable) await client.call(['FLUSHALL']);
});

describe.skipIf(!redisAvailable)('against a real Redis', () => {
  it('runs the compare-and-set script, expiries and all', async () => {
    const kv = upstashKv(base, TOKEN);
    const prefix = keys.table('REAL1');
    await kv.set(keys.version('REAL1'), '0', TABLE_TTL_SECONDS);

    expect(await kv.casState(prefix, 0, '{"season":1}', TABLE_TTL_SECONDS)).toBe(1);
    expect(await client.call(['GET', keys.state('REAL1')])).toBe('{"season":1}');
    expect(await client.call(['GET', keys.version('REAL1')])).toBe('1');
    // Both keys carry the table's expiry, so an abandoned game clears itself.
    for (const key of [keys.state('REAL1'), keys.version('REAL1')]) {
      const ttl = (await client.call(['TTL', key])) as number;
      expect(ttl).toBeGreaterThan(TABLE_TTL_SECONDS - 60);
      expect(ttl).toBeLessThanOrEqual(TABLE_TTL_SECONDS);
    }

    // A writer holding the version before that one is turned away.
    expect(await kv.casState(prefix, 0, '{"season":"stale"}', TABLE_TTL_SECONDS)).toBeNull();
    expect(await client.call(['GET', keys.state('REAL1')])).toBe('{"season":1}');
  });

  it('starts from nothing, with no version key written yet', async () => {
    const kv = upstashKv(base, TOKEN);
    // The script reads a missing key as zero rather than failing on it.
    expect(await kv.casState(keys.table('REAL2'), 0, '{}', TABLE_TTL_SECONDS)).toBe(1);
    expect(await kv.casState(keys.table('REAL2'), 0, '{}', TABLE_TTL_SECONDS)).toBeNull();
  });

  it('lets exactly one of two simultaneous writers through', async () => {
    const kv = upstashKv(base, TOKEN);
    const prefix = keys.table('REAL3');
    await kv.set(keys.version('REAL3'), '0', TABLE_TTL_SECONDS);

    const [a, b] = await Promise.all([
      kv.casState(prefix, 0, '{"by":"a"}', TABLE_TTL_SECONDS),
      kv.casState(prefix, 0, '{"by":"b"}', TABLE_TTL_SECONDS),
    ]);
    expect([a, b].filter((result) => result !== null)).toHaveLength(1);
    expect(await client.call(['GET', keys.version('REAL3')])).toBe('1');
  });

  it('plays a table through from the deal to a move', async () => {
    const kv = upstashKv(base, TOKEN);
    const created = await createTable(kv, {
      seats: 4,
      expansions: { nightfall: true, wildlife: true },
    });
    const code = created.lobby.code;
    await joinTable(kv, { code, seat: 1, token: created.seatTokens[1].token, name: 'Kris' });

    const started = await startTable(kv, { code, hostToken: created.hostToken });
    expect(started.lobby?.seats.map((s) => s.kind)).toEqual(['cpu', 'human', 'cpu', 'cpu']);
    // Seat 0 is a CPU, so it has already played by the time the board lands.
    expect(started.view!.current).toBe(1);

    const move = legalMoves(started.view!)[0];
    const played = await act(kv, {
      code,
      seat: 1,
      token: created.seatTokens[1].token,
      action: { type: 'move', hikerId: move.hikerId, to: move.to, useCampfire: move.useCampfire },
    });
    expect(played.view!.log.some((entry) => entry.player === 1)).toBe(true);

    // The state on the wire is the redacted one; the deck never goes to a seat.
    expect(played.view!.parkDeck).toEqual([]);
    // But the authoritative copy in Redis still holds it.
    const stored = JSON.parse((await client.call(['GET', keys.state(code)])) as string);
    expect(stored.parkDeck.length).toBeGreaterThan(40);
  });
});
