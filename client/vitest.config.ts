import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../shared/src'),
    },
  },
});
