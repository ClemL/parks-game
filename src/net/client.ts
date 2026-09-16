import type {
  ActRequest,
  CreatedTable,
  CreateRequest,
  JoinRequest,
  Lobby,
  StartRequest,
  StateResponse,
} from './protocol';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function send<T>(path: string, init?: RequestInit & { token?: string }): Promise<T> {
  const headers: Record<string, string> = {};
  if (init?.body) headers['content-type'] = 'application/json';
  if (init?.token) headers.authorization = `Bearer ${init.token}`;
  const response = await fetch(path, { ...init, headers });
  const body = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new ApiError(body.error ?? `request failed (${response.status})`, response.status);
  return body;
}

const post = <T>(path: string, body: unknown): Promise<T> =>
  send<T>(path, { method: 'POST', body: JSON.stringify(body) });

export const api = {
  createTable: (request: CreateRequest) => post<CreatedTable>('/api/table', request),
  join: (request: JoinRequest) => post<Lobby>('/api/join', request),
  start: (request: StartRequest) => post<StateResponse>('/api/start', request),
  act: (request: ActRequest) => post<StateResponse>('/api/act', request),
  state: (query: { code: string; seat?: number | null; token?: string; since?: number }) => {
    const params = new URLSearchParams({ code: query.code });
    if (query.seat !== null && query.seat !== undefined) params.set('seat', String(query.seat));
    if (query.since !== undefined) params.set('since', String(query.since));
    return send<StateResponse>(`/api/state?${params.toString()}`, { token: query.token });
  },
};
