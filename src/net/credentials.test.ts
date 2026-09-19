import { describe, expect, it } from 'vitest';
// @ts-expect-error - a plain script module, deliberately not part of the app build
import { credentials } from '../../scripts/upstash-credentials.mjs';

/**
 * `npm run redis` reads its credentials out of markdown, whose shape is not a
 * contract. These are the forms the same pair is usually presented in; the
 * command falls back to printing the whole answer when none of them match, so
 * the worst case is copying two values by hand.
 */
describe('reading credentials out of the answer', () => {
  it('takes them from an environment block', () => {
    const answer = [
      '# Your Redis database',
      '',
      '```bash',
      'UPSTASH_REDIS_REST_URL="https://apt-mongoose-12345.upstash.io"',
      'UPSTASH_REDIS_REST_TOKEN="AaBbCcDdEeFfGgHhIiJjKkLlMmNnOo="',
      '```',
      '',
      'View usage and claim it: https://console.upstash.com/redis/abc-123?teamid=0',
    ].join('\n');
    expect(credentials(answer)).toEqual({
      url: 'https://apt-mongoose-12345.upstash.io',
      token: 'AaBbCcDdEeFfGgHhIiJjKkLlMmNnOo=',
      console: 'https://console.upstash.com/redis/abc-123?teamid=0',
    });
  });

  it('takes them from a curl example', () => {
    const answer = [
      'Try it:',
      '',
      '    curl https://apt-mongoose-12345.upstash.io/set/foo/bar \\',
      '      -H "Authorization: Bearer AaBbCcDdEeFfGgHhIiJjKkLlMmNnOo="',
    ].join('\n');
    const read = credentials(answer);
    expect(read.url).toBe('https://apt-mongoose-12345.upstash.io');
    expect(read.token).toBe('AaBbCcDdEeFfGgHhIiJjKkLlMmNnOo=');
  });

  it('takes the token out of a rediss:// line when that is all there is', () => {
    const answer =
      'REST: https://apt-mongoose-12345.upstash.io\n' +
      'rediss://default:AaBbCcDdEeFfGgHhIiJjKkLlMmNnOo=@apt-mongoose-12345.upstash.io:6379\n';
    expect(credentials(answer).token).toBe('AaBbCcDdEeFfGgHhIiJjKkLlMmNnOo=');
  });

  it('says nothing rather than something wrong when it cannot tell', () => {
    const read = credentials('Something went sideways. No database this time.');
    expect(read.url).toBeUndefined();
    expect(read.token).toBeUndefined();
  });
});
