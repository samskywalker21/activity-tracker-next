import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'

vi.mock('next/headers', async () => (await import('../next-mocks')).nextHeaders)
vi.mock('next/headers.js', async () => (await import('../next-mocks')).nextHeaders)
vi.mock('next/navigation', async () => (await import('../next-mocks')).nextNavigation)
vi.mock('next/cache', async () => (await import('../next-mocks')).nextCache)

const {
  changeOwnPassword,
  createProfile,
  setPassword,
  setProfileActive,
  setRole,
  updateOwnProfile,
  updateProfile,
} = await import('@/actions/profiles')
const { db } = await import('@/lib/db')
const { getOptionalUser } = await import('@/lib/session')
const { createSection, createUser, resetDb, signInAs } = await import('../helpers')

let sectionId: number
let adminId: string
let staffId: string

const profile = (overrides: object = {}) => ({
  firstName: 'Maria',
  middleName: '',
  lastName: 'Santos',
  username: 'maria.s',
  position: 'Nurse II',
  sectionId,
  ...overrides,
})

beforeAll(async () => {
  await resetDb()
  sectionId = (await createSection()).id
  adminId = (await createUser({ username: 'admin', role: 'ADMIN', sectionId })).id
  await createUser({ username: 'manager', role: 'MANAGER', sectionId })
  staffId = (await createUser({ username: 'staff', sectionId })).id
})

beforeEach(async () => {
  await db.auditLog.deleteMany()
})

describe('admin', () => {
  test('creates a profile with a role, audited as the admin and without the password', async () => {
    await signInAs('admin')
    const result = await createProfile({ ...profile(), password: 'pass1234', role: 'MANAGER' })
    expect(result).toEqual({ ok: true, data: undefined })

    const user = await db.user.findUniqueOrThrow({ where: { username: 'maria.s' } })
    expect(user).toMatchObject({ name: 'Maria Santos', role: 'MANAGER', isActive: true })

    const rows = await db.auditLog.findMany()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ action: 'user.create', actorId: adminId, entityId: user.id })
    expect(JSON.stringify(rows[0])).not.toContain('pass1234')

    // The new user can sign in with that password.
    await signInAs('maria.s', 'pass1234')
    expect((await getOptionalUser())?.id).toBe(user.id)
  })

  test('only admins create, edit and manage profiles', async () => {
    await signInAs('manager')
    await expect(
      createProfile({ ...profile({ username: 'nope' }), password: 'pass1234', role: 'STAFF' })
    ).rejects.toThrow('permission')
    await expect(updateProfile(staffId, profile({ username: 'staff' }))).rejects.toThrow(
      'permission'
    )
    await expect(setRole(staffId, 'ADMIN')).rejects.toThrow('permission')
    await expect(setProfileActive(staffId, false)).rejects.toThrow('permission')
    await expect(setPassword(staffId, { password: 'pass1234' })).rejects.toThrow('permission')
  })

  test('a taken username is refused, whatever its case', async () => {
    await signInAs('admin')
    expect(await updateProfile(staffId, profile({ username: 'Manager' }))).toMatchObject({
      ok: false,
      fieldErrors: { username: ['That username is already taken'] },
    })
  })

  test('changes a role, audited with a diff', async () => {
    await signInAs('admin')
    expect(await setRole(staffId, 'MANAGER')).toEqual({ ok: true, data: undefined })
    expect(await db.auditLog.findFirst()).toMatchObject({
      action: 'user.set_role',
      diff: { role: ['STAFF', 'MANAGER'] },
    })
    await setRole(staffId, 'STAFF')
  })

  test('cannot change their own role or deactivate themselves', async () => {
    await signInAs('admin')
    expect(await setRole(adminId, 'STAFF')).toMatchObject({ ok: false })
    expect(await setProfileActive(adminId, false)).toMatchObject({ ok: false })
  })

  test('deactivating ends the user’s sessions at once', async () => {
    await signInAs('staff')
    expect(await db.session.count({ where: { userId: staffId } })).toBeGreaterThan(0)

    await signInAs('admin')
    await setProfileActive(staffId, false)
    expect(await db.session.count({ where: { userId: staffId } })).toBe(0)

    await setProfileActive(staffId, true)
  })

  test('an admin resetting their own password is signed out everywhere', async () => {
    await signInAs('admin') // another device
    await signInAs('admin')
    await expect(setPassword(adminId, { password: 'newadmin' })).rejects.toThrow(
      'REDIRECT /sign-in'
    )
    expect(await db.session.count({ where: { userId: adminId } })).toBe(0)

    await signInAs('admin', 'newadmin')
    await expect(setPassword(adminId, { password: 'secret' })).rejects.toThrow('REDIRECT')
  })

  test('sets a password without knowing the old one; the audit row has no password', async () => {
    await signInAs('admin')
    expect(await setPassword(staffId, { password: 'newpass' })).toEqual({
      ok: true,
      data: undefined,
    })
    expect(JSON.stringify(await db.auditLog.findMany())).not.toContain('newpass')

    await signInAs('staff', 'newpass')
    expect((await getOptionalUser())?.username).toBe('staff')

    await signInAs('admin')
    await setPassword(staffId, { password: 'secret' })
  })
})

describe('self', () => {
  test('edits their own profile; role and active flag in the input are ignored', async () => {
    await signInAs('staff')
    const result = await updateOwnProfile({
      ...profile({ username: 'Staff.One', firstName: 'Juan' }),
      role: 'ADMIN',
      isActive: false,
    })
    expect(result).toEqual({ ok: true, data: undefined })

    expect(await db.user.findUnique({ where: { id: staffId } })).toMatchObject({
      username: 'staff.one',
      displayUsername: 'Staff.One',
      name: 'Juan Santos',
      role: 'STAFF',
      isActive: true,
    })
    expect(await db.auditLog.findFirst()).toMatchObject({ action: 'user.update', actorId: staffId })

    await updateOwnProfile(profile({ username: 'staff', firstName: 'Test', lastName: 'staff' }))
  })

  test('a wrong current password is reported on that field', async () => {
    await signInAs('staff')
    const result = await changeOwnPassword({
      currentPassword: 'wrong',
      newPassword: 'pass1234',
      confirmPassword: 'pass1234',
    })
    expect(result).toMatchObject({
      ok: false,
      fieldErrors: { currentPassword: [expect.any(String)] },
    })
  })

  test('changing the password audits it and signs out everywhere', async () => {
    await signInAs('staff') // another device
    await signInAs('staff')
    await expect(
      changeOwnPassword({
        currentPassword: 'secret',
        newPassword: 'pass1234',
        confirmPassword: 'pass1234',
      })
    ).rejects.toThrow('REDIRECT /sign-in')

    expect(await db.session.count({ where: { userId: staffId } })).toBe(0)
    const actions = (await db.auditLog.findMany({ orderBy: { id: 'asc' } })).map((r) => r.action)
    expect(actions).toContain('auth.password_change')
    expect(JSON.stringify(await db.auditLog.findMany())).not.toContain('pass1234')

    await signInAs('staff', 'pass1234')
    expect((await getOptionalUser())?.username).toBe('staff')
  })
})
