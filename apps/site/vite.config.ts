import { defineConfig } from 'vite';
import { normalizeBase } from './src/paths';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  base: normalizeBase(process.env.SITE_BASE),
  resolve: { dedupe: ['react', 'react-dom'] },
  build: { manifest: true, rollupOptions: { input: { index: fileURLToPath(new URL('./index.html', import.meta.url)), previews: fileURLToPath(new URL('./src/preview-styles.ts', import.meta.url)) } } },
});
