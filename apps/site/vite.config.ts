import { defineConfig } from 'vite';
import { normalizeBase } from './src/paths';

export default defineConfig({
  base: normalizeBase(process.env.SITE_BASE),
  resolve: { dedupe: ['react', 'react-dom'] },
  build: { manifest: true },
});
