import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: [{ find: /^@prism-ui\/core$/, replacement: fileURLToPath(new URL('./src/instrumented-core.ts', import.meta.url)) }],
  },
  optimizeDeps: { exclude: ['@prism-ui/core', '@prism-ui/react', '@prism-ui/components', '@prism-ui/state'] },
});
