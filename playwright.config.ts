import { defineConfig, devices } from '@playwright/test';

/**
 * Browser smoke tests: the built app (vite preview) and the API with an in-memory database, the AI
 * stood in for by each test. Run after `npm run build` with `npm run e2e`.
 */
const PORT = 5175;

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'off',
    ...devices['Desktop Chrome'],
  },
  webServer: [
    {
      // NODE_ENV=test: an in-memory database and no sign-up limits.
      command: 'node server/src/index.js',
      env: { NODE_ENV: 'test', PORT: '3001', JWT_SECRET: 'e2e-'.padEnd(48, 'x') },
      url: 'http://localhost:3001/api/health',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: `npx vite preview --port ${PORT} --strictPort`,
      url: `http://localhost:${PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
