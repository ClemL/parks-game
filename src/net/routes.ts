import { act, createTable, joinTable, readState, startTable, TableError } from './table';
import type { Kv } from './kv';
import type { ActRequest, CreateRequest, JoinRequest, StartRequest } from './protocol';

export interface ApiRequest {
  method: string;
  /** Path with the /api prefix already stripped, e.g. "state". */
  route: string;
  query: Record<string, string | undefined>;
  /** Lower-cased header names. The seat token arrives here, not in the URL. */
  headers?: Record<string, string | undefined>;
  body: unknown;
}

/** A seat token sent as `Authorization: Bearer <token>`. */
function bearer(headers: ApiRequest['headers']): string | undefined {
  const value = headers?.authorization ?? headers?.Authorization;
  return value?.startsWith('Bearer ') ? value.slice('Bearer '.length) : undefined;
}

export interface ApiReply {
  status: number;
  body: unknown;
}

const number = (value: string | undefined): number | undefined =>
  value === undefined || value === '' || Number.isNaN(Number(value)) ? undefined : Number(value);

/**
 * One dispatcher for every table route, so the Vercel functions and the local
 * dev server run exactly the same code path.
 */
export async function handle(kv: Kv, request: ApiRequest): Promise<ApiReply> {
  try {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const post = request.method === 'POST';

    if (request.route === 'table' && post) {
      return { status: 200, body: await createTable(kv, body as unknown as CreateRequest) };
    }
    if (request.route === 'join' && post) {
      return { status: 200, body: await joinTable(kv, body as unknown as JoinRequest) };
    }
    if (request.route === 'start' && post) {
      return { status: 200, body: await startTable(kv, body as unknown as StartRequest) };
    }
    if (request.route === 'act' && post) {
      return { status: 200, body: await act(kv, body as unknown as ActRequest) };
    }
    if (request.route === 'state' && request.method === 'GET') {
      const seat = number(request.query.seat);
      return {
        status: 200,
        body: await readState(kv, {
          code: String(request.query.code ?? ''),
          seat: seat === undefined ? null : seat,
          // Header first: a token in the query string would land in the
          // platform's request logs on every poll.
          token: bearer(request.headers) ?? request.query.token,
          since: number(request.query.since),
        }),
      };
    }
    return { status: 404, body: { error: 'no such route' } };
  } catch (error) {
    if (error instanceof TableError) return { status: error.status, body: { error: error.message } };
    const message = error instanceof Error ? error.message : 'something went wrong';
    return { status: 500, body: { error: message } };
  }
}
