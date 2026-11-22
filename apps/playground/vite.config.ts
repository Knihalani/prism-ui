import { defineConfig } from 'vite';

export default defineConfig({
  build: { rollupOptions: { input: { chat: 'index.html', themes: 'themes.html' } } },
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: { exclude: ['@prism-ui/core', '@prism-ui/react', '@prism-ui/components', '@prism-ui/state'] },
});
