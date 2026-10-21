import { execSync } from 'node:child_process'

/** A fresh test database for every run; see `e2e/seed.ts`. */
export default function globalSetup() {
  execSync('pnpm exec tsx e2e/seed.ts', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL },
  })
}
