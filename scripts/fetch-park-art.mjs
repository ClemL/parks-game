#!/usr/bin/env node
/**
 * Downloads each park's lead photograph from Wikipedia, with its artist and
 * license, into `public/parks/`. The app prefers these local files and falls
 * back to fetching Wikipedia at runtime, then to generated artwork.
 *
 * Run it where Wikipedia is reachable:
 *   node scripts/fetch-park-art.mjs
 *
 * It writes:
 *   public/parks/<park-id>.jpg
 *   public/parks/credits.json   (park id -> {file, artist, license, filePage})
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';

const API = 'https://en.wikipedia.org/w/api.php';
const OUT = path.join(process.cwd(), 'public', 'parks');
const UA = 'TrailsideSeasons/1.0 (hobby board game; art fetch script)';

/** Pull the park list straight out of the game data, so it cannot drift. */
async function parks() {
  const source = await import('node:fs/promises').then((fs) =>
    fs.readFile(path.join(process.cwd(), 'src/game/data/parks.ts'), 'utf8'),
  );
  const out = [];
  const re = /id: '([^']+)',[\s\S]*?wikiTitle: '([^']+)'/g;
  let match;
  while ((match = re.exec(source))) out.push({ id: match[1], title: match[2] });
  return out;
}

function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function api(params) {
  const query = new URLSearchParams({ format: 'json', ...params });
  const response = await fetch(`${API}?${query}`, { headers: { 'user-agent': UA } });
  if (!response.ok) throw new Error(`wikipedia ${response.status}`);
  return response.json();
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const list = await parks();
  console.log(`resolving art for ${list.length} parks`);

  const byTitle = new Map(list.map((p) => [p.title, p.id]));
  const resolved = new Map();

  for (const group of chunk(list, 20)) {
    const data = await api({
      action: 'query',
      prop: 'pageimages',
      piprop: 'thumbnail|name',
      pithumbsize: '900',
      redirects: '1',
      titles: group.map((p) => p.title).join('|'),
    });
    const alias = new Map();
    for (const entry of data?.query?.normalized ?? []) alias.set(entry.to, entry.from);
    for (const entry of data?.query?.redirects ?? []) {
      alias.set(entry.to, alias.get(entry.from) ?? entry.from);
    }
    for (const page of Object.values(data?.query?.pages ?? {})) {
      const asked = alias.get(page.title) ?? page.title;
      const id = byTitle.get(asked);
      if (!id || !page.thumbnail?.source) continue;
      resolved.set(id, {
        url: page.thumbnail.source,
        fileTitle: page.pageimage ? `File:${page.pageimage}` : undefined,
      });
    }
  }

  // Attribution for every file we are about to keep.
  const files = [...new Set([...resolved.values()].map((e) => e.fileTitle).filter(Boolean))];
  const meta = new Map();
  for (const group of chunk(files, 20)) {
    const data = await api({
      action: 'query',
      prop: 'imageinfo',
      iiprop: 'extmetadata|url',
      iiextmetadatafilter: 'Artist|LicenseShortName|Credit',
      titles: group.join('|'),
    });
    for (const page of Object.values(data?.query?.pages ?? {})) {
      const info = page.imageinfo?.[0];
      if (!info) continue;
      const strip = (v) => (v ? String(v).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() : undefined);
      meta.set(page.title, {
        artist: strip(info.extmetadata?.Artist?.value) ?? strip(info.extmetadata?.Credit?.value),
        license: strip(info.extmetadata?.LicenseShortName?.value),
        filePage: info.descriptionurl,
      });
    }
  }

  const credits = {};
  let saved = 0;
  for (const [id, entry] of resolved) {
    const ext = (entry.url.match(/\.(jpe?g|png|webp)$/i)?.[1] ?? 'jpg').toLowerCase();
    const file = `${id}.${ext === 'jpeg' ? 'jpg' : ext}`;
    const response = await fetch(entry.url, { headers: { 'user-agent': UA } });
    if (!response.ok) {
      console.warn(`  ${id}: image ${response.status}`);
      continue;
    }
    await pipeline(response.body, createWriteStream(path.join(OUT, file)));
    credits[id] = { file, ...(entry.fileTitle ? meta.get(entry.fileTitle) ?? {} : {}) };
    saved += 1;
  }

  await writeFile(path.join(OUT, 'credits.json'), `${JSON.stringify(credits, null, 2)}\n`);
  console.log(`saved ${saved} images and credits.json to public/parks/`);
  const missing = list.filter((p) => !credits[p.id]);
  if (missing.length > 0) {
    console.log(`no photo for ${missing.length}: ${missing.map((p) => p.id).join(', ')}`);
    console.log('those cards use the generated artwork instead.');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
