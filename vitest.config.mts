import 'dotenv/config'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Action tests share one Postgres test database and truncate it between files.
    env: { DATABASE_URL: process.env.TEST_DATABASE_URL ?? '' },
    fileParallelism: false,
    // Process better-auth through Vitest so its own `next/headers` import sees the test mocks.
    server: { deps: { inline: ['better-auth'] } },
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('.', import.meta.url)) },
  },
})
