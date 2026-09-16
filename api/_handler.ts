import type { IncomingMessage, ServerResponse } from 'node:http';
import { handle, type ApiRequest } from '../src/net/routes';
import { kvFromEnv } from '../src/net/kv';

/**
 * Adapter between a Vercel Node function and the shared dispatcher. Each route
 * file is one line on top of this; the logic lives in src/net so the tests and
 * the local dev server can reach it without a Vercel runtime.
 */
export function vercelRoute(route: string) {
  return async function serve(req: IncomingMessage & { body?: unknown }, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', 'http://table.local');
    const request: ApiRequest = {
      method: req.method ?? 'GET',
      route,
      query: Object.fromEntries(url.searchParams),
      headers: req.headers as Record<string, string | undefined>,
      body: typeof req.body === 'string' ? safeJson(req.body) : (req.body ?? (await readBody(req))),
    };
    let reply;
    try {
      reply = await handle(kvFromEnv(process.env), request);
    } catch (error) {
      // A missing store is a deployment problem, not a bad request: say which.
      reply = { status: 503, body: { error: error instanceof Error ? error.message : 'no store' } };
    }
    res.statusCode = reply.status;
    res.setHeader('content-type', 'application/json');
    // Table state is per-request and secret-bearing: never let a CDN hold it.
    res.setHeader('cache-control', 'no-store');
    res.end(JSON.stringify(reply.body));
  };
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  if (chunks.length === 0) return {};
  return safeJson(Buffer.concat(chunks).toString('utf8'));
}
