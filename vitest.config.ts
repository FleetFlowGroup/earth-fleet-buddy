import { defineConfig } from 'vitest/config';

// Keep offline unit tests independent of the app's server/build plugins.
export default defineConfig({ test: { environment: 'node' } });