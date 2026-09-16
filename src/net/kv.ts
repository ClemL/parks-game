/**
 * The slice of Redis the table needs, small enough to fake in a test and to
 * implement over Upstash's REST API without a client library.
 */
export interface Kv {
  get(key: string): Promise<string | null>;
  /** One round trip for the whole seat row. */
  mget(keys: string[]): Promise<(string | null)[]>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  /** Bumps the version when something other than the state changed. */
  incr(key: string): Promise<number>;
  /**
   * Writes `state` only if `version` still holds, then bumps it. Returns the
   * new version, or null when somebody else got there first.
   */
  casState(prefix: string, version: number, state: string, ttlSeconds: number): Promise<number | null>;
}

/** Keys for one table. */
export const keys = {
  table: (code: string) => `table:${code}`,
  state: (code: string) => `table:${code}:state`,
  version: (code: string) => `table:${code}:version`,
};

/** A table is forgotten this long after its last write. */
export const TABLE_TTL_SECONDS = 12 * 60 * 60;

/**
 * In-process store. Used by the tests and by `npm run dev`, so the whole table
 * mode runs with no Redis and no account; a single server process is all the
 * consistency it needs.
 */
export function memoryKv(): Kv {
  const data = new Map<string, string>();
  return {
    async get(key) {
      return data.get(key) ?? null;
    },
    async mget(keys) {
      return keys.map((key) => data.get(key) ?? null);
    },
    async set(key, value) {
      data.set(key, value);
    },
    async incr(key) {
      const next = Number(data.get(key) ?? '0') + 1;
      data.set(key, String(next));
      return next;
    },
    async casState(prefix, version, state) {
      const current = Number(data.get(`${prefix}:version`) ?? '0');
      if (current !== version) return null;
      const next = current + 1;
      data.set(`${prefix}:state`, state);
      data.set(`${prefix}:version`, String(next));
      return next;
    },
  };
}

/**
 * Upstash Redis over its REST API: one HTTP call per command, no TCP socket, so
 * it works from a serverless function. The compare-and-set is a Lua script
 * because `WATCH`/`MULTI` cannot span REST calls.
 */
export function upstashKv(url: string, token: string): Kv {
  const call = async (command: unknown[]): Promise<unknown> => {
    const response = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(command),
    });
    if (!response.ok) throw new Error(`redis ${response.status}: ${await response.text()}`);
    const body = (await response.json()) as { result?: unknown; error?: string };
    if (body.error) throw new Error(`redis: ${body.error}`);
    return body.result ?? null;
  };

  // Writes the state and bumps the version together, or reports the version it
  // actually found so the caller can retry against it.
  const CAS = `
    local held = tonumber(redis.call('GET', KEYS[2]) or '0')
    if held ~= tonumber(ARGV[1]) then return -1 end
    local next = held + 1
    redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])
    redis.call('SET', KEYS[2], next, 'EX', ARGV[3])
    return next
  `;

  return {
    async get(key) {
      const result = await call(['GET', key]);
      return result === null || result === undefined ? null : String(result);
    },
    async mget(keys) {
      if (keys.length === 0) return [];
      const result = (await call(['MGET', ...keys])) as (string | null)[];
      return keys.map((_, i) => result?.[i] ?? null);
    },
    async set(key, value, ttlSeconds) {
      await call(ttlSeconds ? ['SET', key, value, 'EX', ttlSeconds] : ['SET', key, value]);
    },
    async incr(key) {
      return Number(await call(['INCR', key]));
    },
    async casState(prefix, version, state, ttlSeconds) {
      const result = await call([
        'EVAL',
        CAS,
        2,
        `${prefix}:state`,
        `${prefix}:version`,
        String(version),
        state,
        String(ttlSeconds),
      ]);
      const next = Number(result);
      return next < 0 ? null : next;
    },
  };
}

/**
 * Upstash when its credentials are present, otherwise the in-process store.
 *
 * The fallback is what makes `npm run dev` work with no account, but on a
 * deployment it would be a trap: each function instance would hold its own
 * copy of the table, so a phone and the tablet could land on different games.
 * There it refuses instead of pretending.
 */
export function kvFromEnv(env: Record<string, string | undefined>): Kv {
  const url = env.KV_REST_API_URL ?? env.UPSTASH_REDIS_REST_URL;
  const token = env.KV_REST_API_TOKEN ?? env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) return upstashKv(url, token);
  if (env.VERCEL) {
    throw new Error(
      'Table mode needs a Redis store: set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN ' +
        '(add "Upstash for Redis" from the Vercel Marketplace). Single-device play needs nothing.',
    );
  }
  return sharedMemoryKv();
}

/** One in-process store per server process, so every route shares it. */
let shared: Kv | null = null;
function sharedMemoryKv(): Kv {
  shared ??= memoryKv();
  return shared;
}
