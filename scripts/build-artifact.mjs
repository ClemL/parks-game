// Bundles the app into a single self-contained HTML page for the Claude
// Artifact viewer: no external asset requests, no <html>/<head>/<body> wrapper
// (the viewer supplies its own skeleton).
//
// It runs its own build, because the deployed bundle splits the table and hand
// surfaces into separate chunks that a single inline <script> cannot resolve.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../', import.meta.url).pathname;
const out = 'dist-artifact';
execFileSync('npx', ['vite', 'build', '--outDir', out, '--emptyOutDir'], {
  cwd: root,
  env: { ...process.env, ARTIFACT: '1' },
  stdio: 'inherit',
});

const dist = join(root, out);
const assets = readdirSync(join(dist, 'assets'));
const pick = (ext) => {
  const hits = assets.filter((f) => f.endsWith(ext));
  if (hits.length !== 1) {
    throw new Error(`expected one ${ext} in ${out}/assets, found ${hits.length}: ${hits.join(', ')}`);
  }
  return readFileSync(join(dist, 'assets', hits[0]), 'utf8');
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

const file = join(root, 'dist', 'artifact.html');
writeFileSync(file, page);
rmSync(dist, { recursive: true, force: true });
console.log(`${file} — ${(page.length / 1024).toFixed(0)} kB`);
