import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { tableApi } from './vite-plugin-table-api';

// The artifact build is one self-contained page, so the lazily loaded table and
// hand surfaces are folded back into the single bundle.
const artifact = process.env.ARTIFACT === '1';

export default defineConfig({
  // Relative asset URLs so the bundle also runs when served from a subpath.
  base: './',
  plugins: [react(), tableApi()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    ...(artifact ? { rollupOptions: { output: { inlineDynamicImports: true } } } : {}),
  },
});
