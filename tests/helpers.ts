import type { Role } from '@/generated/prisma/enums'
import { auth, placeholderEmail } from '@/lib/auth'
import { db } from '@/lib/db'
import { jar } from './next-mocks'

/** Empties every table in the test database. */
export async function resetDb() {
  if (!process.env.DATABASE_URL?.includes('test')) {
    throw new Error('Refusing to truncate: DATABASE_URL does not look like a test database')
  }
  const tables = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`
  const list = tables.map((t) => `"${t.tablename}"`).join(', ')
  await db.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`)
}

export async function createSection(code = 'ICTU') {
  const division = await db.division.create({
    data: { code: `D-${code}`, name: `Division ${code}` },
  })
  return db.section.create({ data: { code, name: `Section ${code}`, divisionId: division.id } })
}

/** Creates a user through Better Auth's sign-up, the same way the seed does. */
export async function createUser(opts: {
  username: string
  password?: string
  role?: Role
  isActive?: boolean
  sectionId: number
}) {
  const { user } = await auth.api.signUpEmail({
    body: {
      name: `Test ${opts.username}`,
      email: placeholderEmail(opts.username),
      username: opts.username,
      password: opts.password ?? 'secret',
      firstName: 'Test',
      lastName: opts.username,
      position: 'Tester',
      sectionId: opts.sectionId,
      role: opts.role ?? 'STAFF',
      isActive: opts.isActive ?? true,
    },
  })
  return user
}

/**
 * Signs in through Better Auth; the session cookie lands in the mocked cookie jar. Clears the
 * audit log afterwards so a test sees only the rows its own actions write.
 */
export async function signInAs(username: string, password = 'secret') {
  jar.clear()
  await auth.api.signInUsername({ body: { username, password }, headers: new Headers() })
  await db.auditLog.deleteMany()
}
