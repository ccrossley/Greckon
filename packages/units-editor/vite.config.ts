import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { unitsApiPlugin } from './plugins/units-api';

const packageDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: '/',
  // Unit sprite PNGs live under packages/web/public (shared with the game client).
  publicDir: join(packageDir, '../web/public'),
  plugins: [unitsApiPlugin()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5174,
    fs: {
      allow: ['../..'],
    },
  },
});
