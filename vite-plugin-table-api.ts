import type { Connect, PluginOption, ViteDevServer, PreviewServer } from 'vite';
import { handle } from './src/net/routes';
import { kvFromEnv, multiplayerOff } from './src/net/kv';

/**
 * Serves the table routes during `npm run dev` and `vite preview`, where no
 * Vercel runtime exists. It calls the same dispatcher the deployed functions
 * call, and with no Upstash credentials in the environment it runs against the
 * in-process store — so table mode works offline, on a laptop, with no account.
 *
 * The store is resolved per request, never while the config is being read: this
 * plugin is loaded by `vite build` too, and a build must not depend on, or fall
 * over, the runtime environment.
 */
export function tableApi(): PluginOption {
  const middleware: Connect.NextHandleFunction = (req, res, next) => {
    const url = new URL(req.url ?? '/', 'http://table.local');
    if (!url.pathname.startsWith('/api/')) return next();

    const route = url.pathname.slice('/api/'.length).replace(/\/$/, '');
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      let body: unknown = {};
      if (chunks.length > 0) {
        try {
          body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        } catch {
          body = {};
        }
      }
      handle(kvFromEnv(process.env), {
        method: req.method ?? 'GET',
        route,
        query: Object.fromEntries(url.searchParams),
        headers: req.headers as Record<string, string | undefined>,
        body,
      }, multiplayerOff(process.env))
        .then((reply) => {
          res.statusCode = reply.status;
          res.setHeader('content-type', 'application/json');
          res.setHeader('cache-control', 'no-store');
          res.end(JSON.stringify(reply.body));
        })
        .catch((error: unknown) => {
          res.statusCode = 500;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({ error: String(error) }));
        });
    });
  };

  return {
    name: 'table-api',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server: PreviewServer) {
      server.middlewares.use(middleware);
    },
  };
}
