import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { tableApi } from './vite-plugin-table-api';

export default defineConfig({
  // Relative asset URLs so the bundle also runs when served from a subpath.
  base: './',
  plugins: [react(), tableApi()],
  build: { outDir: 'dist', sourcemap: false },
});
