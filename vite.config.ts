import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { tableApi } from './vite-plugin-table-api';

// The artifact build is one self-contained page, so the lazily loaded table and
// hand surfaces are folded back into the single bundle.
const artifact = process.env.ARTIFACT === '1';

export default defineConfig(({ mode }) => {
  // Table mode reads its credentials from process.env on the server side, which
  // is not where Vite puts .env files. Copy them across so `npm run redis`
  // followed by `npm run dev` just works. Only VITE_-prefixed names ever reach
  // the browser bundle, so the token stays server-side.
  for (const [name, value] of Object.entries(loadEnv(mode, process.cwd(), ''))) {
    process.env[name] ??= value;
  }

  return {
    // Relative asset URLs so the bundle also runs when served from a subpath.
    base: './',
    plugins: [react(), tableApi()],
    build: {
      outDir: 'dist',
      sourcemap: false,
      ...(artifact ? { rollupOptions: { output: { inlineDynamicImports: true } } } : {}),
    },
  };
});
