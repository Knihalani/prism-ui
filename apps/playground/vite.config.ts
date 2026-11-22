import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: { exclude: ['@prism-ui/core', '@prism-ui/react', '@prism-ui/components', '@prism-ui/state'] },
});
