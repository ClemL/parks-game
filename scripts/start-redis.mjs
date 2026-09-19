/*
 * Provisions the Redis database table mode needs, and writes the credentials
 * into .env.local (which is gitignored).
 *
 *   npm run redis
 *
 * Upstash's agent endpoint needs no signup and no UI: it mints a database from
 * a single POST. The idempotency key is kept in .upstash-key.local, so running
 * this again returns the same database rather than making another one — which
 * is also how you re-fetch the credentials if you lose them.
 *
 * The database lives for three days unless it is claimed from the console URL
 * this prints.
 */
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { credentials } from './upstash-credentials.mjs';

const root = new URL('../', import.meta.url).pathname;
const KEY_FILE = join(root, '.upstash-key.local');
const ENV_FILE = join(root, '.env.local');
const ENDPOINT = 'https://upstash.com/start-redis';

const force = process.argv.includes('--force');

/** The same key every time, so a retry returns the database it already made. */
function idempotencyKey() {
  if (existsSync(KEY_FILE)) {
    const held = readFileSync(KEY_FILE, 'utf8').trim();
    if (/^[0-9a-f-]{36}$/i.test(held)) return held;
  }
  const fresh = randomUUID();
  writeFileSync(KEY_FILE, `${fresh}\n`);
  return fresh;
}

/** A round trip, so the command never reports credentials that do not work. */
async function check(url, token) {
  const call = (command) =>
    fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(command),
    }).then((response) => response.json());

  const stamp = String(Date.now());
  const written = await call(['SET', 'trailside:check', stamp, 'EX', 60]);
  if (written.error) throw new Error(written.error);
  const read = await call(['GET', 'trailside:check']);
  if (read.result !== stamp) throw new Error('the database did not answer with what it was given');
}

const key = idempotencyKey();
process.stdout.write(`Asking Upstash for a database (key ${key})…\n`);

let response;
try {
  response = await fetch(ENDPOINT, {
    method: 'POST',
    // Upstash asks agents to say which one they are on every request.
    headers: { 'Idempotency-Key': key, 'User-Agent': 'claude-code' },
  });
} catch (error) {
  process.stderr.write(
    `\nCould not reach ${ENDPOINT}: ${error.message}\n` +
      'The key above is kept, so running this again asks for the same database rather than a second one.\n',
  );
  process.exit(1);
}
const markdown = await response.text();

if (!response.ok) {
  process.stderr.write(
    `\nUpstash answered ${response.status}:\n${markdown}\n\n` +
      'Nothing was written. The key above is kept, so a retry asks for the same database.\n',
  );
  process.exit(1);
}

const { url, token, console: consoleUrl } = credentials(markdown);
if (!url || !token) {
  process.stderr.write(
    '\nCould not find the credentials in the answer. Here it is in full — copy the REST URL and\n' +
      'token into .env.local by hand:\n\n' +
      `${markdown}\n`,
  );
  process.exit(1);
}

if (existsSync(ENV_FILE) && !force) {
  const held = readFileSync(ENV_FILE, 'utf8');
  if (held.includes('UPSTASH_REDIS_REST_URL') && !held.includes(url)) {
    process.stderr.write(
      `\n.env.local already points at another database. Re-run with --force to replace it.\n`,
    );
    process.exit(1);
  }
}

writeFileSync(
  ENV_FILE,
  [
    '# Table mode. Written by `npm run redis`; gitignored. Never commit these.',
    `UPSTASH_REDIS_REST_URL=${url}`,
    `UPSTASH_REDIS_REST_TOKEN=${token}`,
    '',
  ].join('\n'),
);

try {
  await check(url, token);
} catch (error) {
  process.stderr.write(
    `\nThe credentials were written, but a test write failed: ${error.message}\n` +
      'Check the database in the console before playing.\n',
  );
}

process.stdout.write(
  [
    '',
    `Database ready and answering: ${url}`,
    'Credentials written to .env.local, so `npm run dev` and `npm run preview` now run table',
    'mode on it.',
    '',
    'For the deployment, set these two on Vercel (Settings > Environment Variables):',
    `  UPSTASH_REDIS_REST_URL=${url}`,
    `  UPSTASH_REDIS_REST_TOKEN=${token}`,
    '',
    consoleUrl
      ? `Claim it within three days or it is deleted: ${consoleUrl}`
      : 'Claim it within three days from the Upstash console, or it is deleted.',
    '',
  ].join('\n'),
);
