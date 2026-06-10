import { defineConfig } from 'vite';
import { unitsApiPlugin } from './plugins/units-api';

export default defineConfig({
  base: '/',
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
