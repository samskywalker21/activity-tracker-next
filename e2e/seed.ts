// Empties the test database and seeds it for the Playwright flows: the regular seed (admin /
// admin) plus `manager` / `manager` and `staff` / `staff` in ICTU. Run by `global-setup.ts`.
import 'dotenv/config'
import { execSync } from 'node:child_process'
import { db } from '@/lib/db'
import { createUser, resetDb } from '../tests/helpers'

async function main() {
  await resetDb()
  execSync('pnpm exec tsx prisma/seed.ts', { stdio: 'inherit' })

  const { id: sectionId } = await db.section.findUniqueOrThrow({ where: { code: 'ICTU' } })
  await createUser({ username: 'manager', password: 'manager', role: 'MANAGER', sectionId })
  await createUser({ username: 'staff', password: 'staff', sectionId })
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => db.$disconnect())
