/**
 * Park card artwork, resolved in three steps:
 *
 * 1. `public/parks/credits.json`, written by `scripts/fetch-park-art.mjs`. When
 *    those files are committed the app is self-hosted and works offline.
 * 2. Otherwise the browser asks the English Wikipedia API at runtime
 *    (CORS-enabled via `origin=*`) and caches the answer in localStorage.
 * 3. Failing both, the card draws generated vector scenery.
 *
 * Attribution and license travel with the image either way and are listed in
 * the Credits panel.
 */

export interface ArtEntry {
  /** Thumbnail URL served from upload.wikimedia.org. */
  url: string;
  /** File page, for attribution links. */
  filePage?: string;
  artist?: string;
  license?: string;
  fileTitle?: string;
  /** True when the image is served from this site rather than Wikimedia. */
  local?: boolean;
}

export type ArtMap = Record<string, ArtEntry>;

/** What `scripts/fetch-park-art.mjs` writes next to the downloaded images. */
interface LocalCredits {
  [parkId: string]: { file: string; artist?: string; license?: string; filePage?: string };
}

const CACHE_KEY = 'parks-art-cache-v2';
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const API = 'https://en.wikipedia.org/w/api.php';

interface CachePayload {
  at: number;
  art: ArtMap;
}

function readCache(): ArtMap | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachePayload;
    if (!parsed.at || Date.now() - parsed.at > CACHE_TTL_MS) return null;
    return parsed.art ?? null;
  } catch {
    return null;
  }
}

function writeCache(art: ArtMap): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), art } satisfies CachePayload));
  } catch {
    /* private mode or full quota: art simply gets re-fetched next load */
  }
}

function stripHtml(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function apiGet(params: Record<string, string>): Promise<any> {
  const query = new URLSearchParams({ format: 'json', origin: '*', ...params });
  const response = await fetch(`${API}?${query.toString()}`, { mode: 'cors' });
  if (!response.ok) throw new Error(`wikipedia api ${response.status}`);
  return response.json();
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Resolve the lead image of each article title, keyed by the title asked for. */
async function fetchThumbnails(titles: string[]): Promise<ArtMap> {
  const art: ArtMap = {};
  for (const group of chunk(titles, 20)) {
    const data = await apiGet({
      action: 'query',
      prop: 'pageimages',
      piprop: 'thumbnail|name',
      pithumbsize: '720',
      redirects: '1',
      titles: group.join('|'),
    });

    // Map the resolved page titles back to the titles we asked about.
    const alias = new Map<string, string>();
    for (const entry of data?.query?.normalized ?? []) alias.set(entry.to, entry.from);
    for (const entry of data?.query?.redirects ?? []) {
      alias.set(entry.to, alias.get(entry.from) ?? entry.from);
    }

    for (const page of Object.values<any>(data?.query?.pages ?? {})) {
      const asked = alias.get(page.title) ?? page.title;
      if (!page.thumbnail?.source) continue;
      art[asked] = {
        url: page.thumbnail.source,
        fileTitle: page.pageimage ? `File:${page.pageimage}` : undefined,
      };
    }
  }
  return art;
}

/** Add artist and license text for the files we are about to display. */
async function fetchAttribution(art: ArtMap): Promise<void> {
  const files = Array.from(
    new Set(Object.values(art).map((entry) => entry.fileTitle).filter((t): t is string => !!t)),
  );
  const byFile = new Map<string, ArtEntry[]>();
  for (const entry of Object.values(art)) {
    if (!entry.fileTitle) continue;
    const list = byFile.get(entry.fileTitle) ?? [];
    list.push(entry);
    byFile.set(entry.fileTitle, list);
  }

  for (const group of chunk(files, 20)) {
    const data = await apiGet({
      action: 'query',
      prop: 'imageinfo',
      iiprop: 'extmetadata|url',
      iiextmetadatafilter: 'Artist|LicenseShortName|Credit',
      titles: group.join('|'),
    });
    for (const page of Object.values<any>(data?.query?.pages ?? {})) {
      const info = page.imageinfo?.[0];
      if (!info) continue;
      const meta = info.extmetadata ?? {};
      for (const entry of byFile.get(page.title) ?? []) {
        entry.filePage = info.descriptionurl;
        entry.artist = stripHtml(meta.Artist?.value) ?? stripHtml(meta.Credit?.value);
        entry.license = stripHtml(meta.LicenseShortName?.value);
      }
    }
  }
}

/** Self-hosted art, if `scripts/fetch-park-art.mjs` has been run and committed. */
async function loadLocalArt(parks: { id: string; wikiTitle: string }[]): Promise<ArtMap | null> {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}parks/credits.json`, {
      cache: 'force-cache',
    });
    if (!response.ok) return null;
    const credits = (await response.json()) as LocalCredits;
    const art: ArtMap = {};
    for (const park of parks) {
      const entry = credits[park.id];
      if (!entry?.file) continue;
      art[park.wikiTitle] = {
        url: `${import.meta.env.BASE_URL}parks/${entry.file}`,
        artist: entry.artist,
        license: entry.license,
        filePage: entry.filePage,
        local: true,
      };
    }
    return Object.keys(art).length > 0 ? art : null;
  } catch {
    return null;
  }
}

/**
 * Best-effort art lookup: bundled files first, then Wikipedia, then nothing
 * (and the cards draw their own scenery).
 */
export async function loadParkArt(parks: { id: string; wikiTitle: string }[]): Promise<ArtMap> {
  const local = await loadLocalArt(parks);
  if (local) return local;

  const titles = parks.map((p) => p.wikiTitle);
  const cached = readCache();
  if (cached && titles.every((t) => t in cached || cached[t] === null)) return cached;

  const art = await fetchThumbnails(titles);
  try {
    await fetchAttribution(art);
  } catch {
    /* attribution is a nicety; keep the photos even if this call fails */
  }
  const merged = { ...(cached ?? {}), ...art };
  writeCache(merged);
  return merged;
}
