// Bundles the built app into a single self-contained HTML page for the
// Claude Artifact viewer: no external asset requests, no <html>/<head>/<body>
// wrapper (the viewer supplies its own skeleton).
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dist = new URL('../dist/', import.meta.url).pathname;
const assets = readdirSync(join(dist, 'assets'));
const pick = (ext) => {
  const hit = assets.find((f) => f.endsWith(ext));
  if (!hit) throw new Error(`no ${ext} in dist/assets — run "npm run build" first`);
  return readFileSync(join(dist, 'assets', hit), 'utf8');
};

const css = pick('.css');
const js = pick('.js');
const fonts =
  'https://fonts.googleapis.com/css2?family=Zilla+Slab:wght@500;600;700' +
  '&family=Source+Sans+3:wght@400;600;700&display=swap';

const page = `<title>Trailside Seasons</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="${fonts}" />
<style>
${css}
</style>
<div id="root"></div>
<script type="module">
${js}
</script>
`;

const out = join(dist, 'artifact.html');
writeFileSync(out, page);
console.log(`${out} — ${(page.length / 1024).toFixed(0)} kB`);
