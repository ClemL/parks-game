import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Relative asset URLs so the bundle also runs when served from a subpath.
  base: './',
  plugins: [react()],
  build: { outDir: 'dist', sourcemap: false },
});
