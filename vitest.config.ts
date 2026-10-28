import { configDefaults, defineConfig } from 'vitest/config';

// Keep offline unit tests independent of the app's server/build plugins.
export default defineConfig({
  resolve: { alias: { '@': new URL('./src', import.meta.url).pathname } },
  test: {
    environment: 'node',
    // This existing node:test suite runs separately with Bun, not Vitest.
    exclude: [...configDefaults.exclude, 'src/lib/company-membership.test.ts'],
  },
});