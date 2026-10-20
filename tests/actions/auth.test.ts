import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'

// A fake request: cookies Better Auth sets on sign-in are sent back on the next `headers()`.
const { jar, nextHeaders } = vi.hoisted(() => {
  const jar = new Map<string, string>()
  const nextHeaders = {
    headers: async () =>
      new Headers({ cookie: [...jar].map(([name, value]) => `${name}=${value}`).join('; ') }),
    cookies: async () => ({
      set: (name: string, value: string) => (value ? jar.set(name, value) : jar.delete(name)),
    }),
  }
  return { jar, nextHeaders }
})
vi.mock('next/headers', () => nextHeaders)
// Better Auth's nextCookies plugin imports it with the extension.
vi.mock('next/headers.js', () => nextHeaders)
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`)
  },
}))

const { signIn, signOut, signUp } = await import('@/actions/auth')
const { auth } = await import('@/lib/auth')
const { db } = await import('@/lib/db')
const { getOptionalUser, requireRole, requireUser } = await import('@/lib/session')
const { createSection, createUser, resetDb } = await import('../helpers')

let sectionId: number

beforeAll(async () => {
  await resetDb()
  sectionId = (await createSection()).id
  await createUser({ username: 'admin', password: 'admin', role: 'ADMIN', sectionId })
  await createUser({ username: 'manager', role: 'MANAGER', sectionId })
  await createUser({ username: 'staff', sectionId })
  await createUser({ username: 'retired', isActive: false, sectionId })
})

beforeEach(async () => {
  jar.clear()
  await db.auditLog.deleteMany()
})

describe('sign in', () => {
  test('signs in with username and password, sets the session cookie and audits it', async () => {
    await expect(signIn({ username: 'staff', password: 'secret' })).rejects.toThrow('REDIRECT /')

    const user = await getOptionalUser()
    expect(user?.username).toBe('staff')

    const rows = await db.auditLog.findMany()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ action: 'auth.sign_in', actorId: user?.id })
  })

  test('usernames are case-insensitive', async () => {
    await expect(signIn({ username: 'Staff', password: 'secret' })).rejects.toThrow('REDIRECT /')
  })

  test('wrong password is refused and audited with the attempted username, no password', async () => {
    const result = await signIn({ username: 'staff', password: 'wrong-password' })
    expect(result).toEqual({ ok: false, error: 'Invalid username or password' })

    const rows = await db.auditLog.findMany()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      action: 'auth.sign_in_failed',
      actorId: null,
      meta: { username: 'staff', reason: 'Invalid username or password' },
    })
    expect(JSON.stringify(rows[0])).not.toContain('wrong-password')
  })

  test('unknown username is refused the same way', async () => {
    const result = await signIn({ username: 'nobody', password: 'secret' })
    expect(result).toEqual({ ok: false, error: 'Invalid username or password' })
  })

  test('an inactive user is refused and gets no session', async () => {
    const result = await signIn({ username: 'retired', password: 'secret' })
    expect(result).toEqual({ ok: false, error: 'This account has been deactivated' })

    const retired = await db.user.findUniqueOrThrow({ where: { username: 'retired' } })
    expect(await db.session.count({ where: { userId: retired.id } })).toBe(0)
    expect(await db.auditLog.findFirst()).toMatchObject({ action: 'auth.sign_in_failed' })
  })

  test('a session stops working as soon as its user is deactivated', async () => {
    await createUser({ username: 'leaving', sectionId })
    await expect(signIn({ username: 'leaving', password: 'secret' })).rejects.toThrow('REDIRECT')
    expect(await getOptionalUser()).not.toBeNull()

    await db.user.update({ where: { username: 'leaving' }, data: { isActive: false } })
    expect(await getOptionalUser()).toBeNull()
  })

  test('the email sign-in endpoint is disabled', async () => {
    const response = await auth.handler(
      new Request('http://localhost:3000/api/auth/sign-in/email', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'staff@activity-tracker.local', password: 'secret' }),
      })
    )
    expect(response.status).toBe(404)
  })
})

describe('sign up', () => {
  const valid = {
    firstName: 'Juan',
    middleName: '',
    lastName: 'Dela Cruz',
    position: 'Nurse II',
    sectionId: 0,
    username: 'juan.dc',
    password: 'pass1234',
    confirmPassword: 'pass1234',
  }

  test('creates an active STAFF user with a placeholder email, signs in and audits it', async () => {
    await expect(signUp({ ...valid, sectionId })).rejects.toThrow('REDIRECT /')

    const user = await db.user.findUniqueOrThrow({ where: { username: 'juan.dc' } })
    expect(user).toMatchObject({
      name: 'Juan Dela Cruz',
      email: 'juan.dc@activity-tracker.local',
      role: 'STAFF',
      isActive: true,
      middleName: null,
      sectionId,
    })
    expect((await getOptionalUser())?.id).toBe(user.id)
    expect(await db.auditLog.findFirst()).toMatchObject({
      action: 'auth.sign_up',
      actorId: user.id,
      entityType: 'User',
      entityId: user.id,
    })
  })

  test('a taken username is refused', async () => {
    const result = await signUp({ ...valid, sectionId, username: 'staff' })
    expect(result).toMatchObject({ ok: false })
  })

  test('an inactive or unknown section is refused', async () => {
    const result = await signUp({ ...valid, sectionId: 9999, username: 'someone' })
    expect(result).toMatchObject({ ok: false, fieldErrors: { sectionId: ['Choose your section'] } })
  })

  test('validation errors come back per field', async () => {
    const result = await signUp({ ...valid, sectionId, username: 'ab', confirmPassword: 'other' })
    expect(result).toMatchObject({
      ok: false,
      fieldErrors: {
        username: ['Username must be at least 4 characters'],
        confirmPassword: ['Passwords do not match'],
      },
    })
  })

  test('a direct call to the sign-up endpoint cannot set role, isActive or a real email', async () => {
    await auth.api.signUpEmail({
      body: {
        email: 'x@example.com',
        name: 'Sneaky User',
        username: 'sneaky',
        password: 'pass1234',
        firstName: 'Sneaky',
        lastName: 'User',
        position: 'Clerk',
        sectionId,
        // @ts-expect-error not input fields; Better Auth drops them
        role: 'ADMIN',
        isActive: false,
      },
    })

    expect(await db.user.findUnique({ where: { username: 'sneaky' } })).toMatchObject({
      role: 'STAFF',
      isActive: true,
      email: 'sneaky@activity-tracker.local',
    })
  })
})

describe('sign out', () => {
  test('ends the session and audits it', async () => {
    await expect(signIn({ username: 'staff', password: 'secret' })).rejects.toThrow('REDIRECT /')
    const user = await getOptionalUser()

    await expect(signOut()).rejects.toThrow('REDIRECT /sign-in')

    expect(await getOptionalUser()).toBeNull()
    expect(await db.auditLog.findFirst({ where: { action: 'auth.sign_out' } })).toMatchObject({
      actorId: user?.id,
    })
  })
})

describe('guards', () => {
  test('requireUser sends a guest to sign-in', async () => {
    await expect(requireUser()).rejects.toThrow('REDIRECT /sign-in')
  })

  test('requireRole allows listed roles only', async () => {
    await expect(signIn({ username: 'staff', password: 'secret' })).rejects.toThrow('REDIRECT')
    await expect(requireRole(['ADMIN', 'MANAGER'])).rejects.toThrow('permission')
    await expect(requireRole(['STAFF'])).resolves.toMatchObject({ username: 'staff' })

    jar.clear()
    await expect(signIn({ username: 'manager', password: 'secret' })).rejects.toThrow('REDIRECT')
    await expect(requireRole(['ADMIN', 'MANAGER'])).resolves.toMatchObject({ role: 'MANAGER' })
    await expect(requireRole(['ADMIN'])).rejects.toThrow('permission')

    jar.clear()
    await expect(signIn({ username: 'admin', password: 'admin' })).rejects.toThrow('REDIRECT')
    await expect(requireRole(['ADMIN'])).resolves.toMatchObject({ role: 'ADMIN' })
  })
})
