import 'dotenv/config'
import { defineConfig, devices } from '@playwright/test'

// The flows run against the test database on their own production server, so they never touch
// dev data. They share that database, so they run one at a time. Don't run them alongside
// `pnpm test`, which truncates the same database.
const port = 3100

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  workers: 1,
  use: {
    baseURL: `http://localhost:${port}`,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `pnpm build && pnpm start --port ${port}`,
    url: `http://localhost:${port}/sign-in`,
    timeout: 300_000,
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? '',
      BETTER_AUTH_URL: `http://localhost:${port}`,
    },
  },
})
