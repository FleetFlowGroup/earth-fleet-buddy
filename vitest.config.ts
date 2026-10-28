import { defineConfig } from 'vitest/config';

// Keep offline unit tests independent of the app's server/build plugins.
export default defineConfig({
  resolve: { alias: { '@': new URL('./src', import.meta.url).pathname } },
  test: { environment: 'node' },
});