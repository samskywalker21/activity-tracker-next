import type { Role } from '@/generated/prisma/enums'
import { auth, placeholderEmail } from '@/lib/auth'
import { db } from '@/lib/db'

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

/** Creates a user with a credential account, the same way the seed does. */
export async function createUser(opts: {
  username: string
  password?: string
  role?: Role
  isActive?: boolean
  sectionId: number
}) {
  const ctx = await auth.$context
  const user = await ctx.internalAdapter.createUser(
    {
      name: `Test ${opts.username}`,
      email: placeholderEmail(opts.username),
      username: opts.username,
      firstName: 'Test',
      lastName: opts.username,
      position: 'Tester',
      sectionId: opts.sectionId,
      role: opts.role ?? 'STAFF',
      isActive: opts.isActive ?? true,
    },
    { method: 'admin' }
  )
  await ctx.internalAdapter.linkAccount({
    userId: user.id,
    providerId: 'credential',
    accountId: user.id,
    password: await ctx.password.hash(opts.password ?? 'secret'),
  })
  return user
}
