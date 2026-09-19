/**
 * Reads the REST credentials out of the markdown Upstash's agent endpoint
 * answers with. Its exact shape is not contractual, so this copes with the
 * forms the same credentials are usually shown in: the environment-variable
 * block, a curl example's bearer header, and a rediss:// line whose password is
 * the token.
 */
export function credentials(markdown) {
  const url = markdown.match(/https:\/\/[a-z0-9-]+\.upstash\.io/i)?.[0];
  const token =
    markdown.match(/UPSTASH_REDIS_REST_TOKEN\s*[:=]\s*["']?([A-Za-z0-9_=-]{20,})["']?/)?.[1] ??
    markdown.match(/Bearer\s+([A-Za-z0-9_=-]{20,})/)?.[1] ??
    // Upstash often shows a rediss:// line too, where the password is the token.
    markdown.match(/rediss:\/\/[^:\s]*:([A-Za-z0-9_=-]{20,})@/)?.[1];
  const consoleUrl = markdown.match(/https:\/\/console\.upstash\.com\/\S*/)?.[0];
  return { url, token, console: consoleUrl };
}
