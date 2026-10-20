'use server'

import { isAPIError } from 'better-auth/api'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import type { z } from 'zod'
import { type ActionResult, validationFailed } from '@/lib/action-result'
import { audit, diff } from '@/lib/audit'
import { auth, placeholderEmail } from '@/lib/auth'
import { db } from '@/lib/db'
import { requireRole, requireUser } from '@/lib/session'
import {
  changeOwnPasswordSchema,
  createProfileSchema,
  profileSchema,
  setPasswordSchema,
  setRoleSchema,
} from '@/schemas/profiles'

const usernameTaken: ActionResult = {
  ok: false,
  error: 'Please correct the highlighted fields',
  fieldErrors: { username: ['That username is already taken'] },
}

const noSection: ActionResult = {
  ok: false,
  error: 'Please correct the highlighted fields',
  fieldErrors: { sectionId: ['Choose a section'] },
}

// Stored the way Better Auth's username plugin stores them: lowercase `username` for lookups,
// the typed form in `displayUsername`. `name` is required by Better Auth and kept in sync.
function profileData(input: z.output<typeof profileSchema>) {
  return {
    firstName: input.firstName,
    middleName: input.middleName || null,
    lastName: input.lastName,
    name: `${input.firstName} ${input.lastName}`,
    username: input.username.toLowerCase(),
    displayUsername: input.username,
    position: input.position,
    sectionId: input.sectionId,
  }
}

async function usernameInUse(username: string, exceptUserId?: string) {
  const user = await db.user.findUnique({ where: { username: username.toLowerCase() } })
  return user !== null && user.id !== exceptUserId
}

async function sectionIsActive(sectionId: number) {
  const section = await db.section.findUnique({ where: { id: sectionId } })
  return section?.isActive === true
}

/** Shared by the admin edit and the self edit; `actorId` is who is saving. */
async function saveProfile(actorId: string, id: string, input: unknown): Promise<ActionResult> {
  const parsed = profileSchema.safeParse(input)
  if (!parsed.success) return validationFailed(parsed.error)

  const user = await db.user.findUnique({ where: { id } })
  if (!user) return { ok: false, error: 'Profile not found' }
  if (await usernameInUse(parsed.data.username, id)) return usernameTaken
  // Keeping a section that has since been deactivated is fine; moving to one is not.
  if (parsed.data.sectionId !== user.sectionId && !(await sectionIsActive(parsed.data.sectionId))) {
    return noSection
  }

  const data = profileData(parsed.data)
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id }, data })
    await audit(tx, {
      actorId,
      action: 'user.update',
      entityType: 'User',
      entityId: id,
      diff: diff(user, data),
    })
  })

  revalidatePath('/', 'layout')
  return { ok: true, data: undefined }
}

// --- Admin ---------------------------------------------------------------------------------

export async function createProfile(input: unknown): Promise<ActionResult> {
  const admin = await requireRole(['ADMIN'])
  const parsed = createProfileSchema.safeParse(input)
  if (!parsed.success) return validationFailed(parsed.error)

  if (await usernameInUse(parsed.data.username)) return usernameTaken
  if (!(await sectionIsActive(parsed.data.sectionId))) return noSection

  const data = profileData(parsed.data)
  try {
    // Through Better Auth so the password is hashed the way sign-in verifies it. Without request
    // headers it writes no `auth.sign_up` row, so the admin's own row below is the only one.
    const { user } = await auth.api.signUpEmail({
      body: {
        ...data,
        middleName: data.middleName ?? undefined,
        email: placeholderEmail(data.username),
        password: parsed.data.password,
        role: parsed.data.role,
      },
    })
    // Not in one transaction with the insert: Better Auth writes the user and account itself.
    await audit(db, {
      actorId: admin.id,
      action: 'user.create',
      entityType: 'User',
      entityId: user.id,
      diff: diff({}, { ...data, role: parsed.data.role }),
    })
  } catch (error) {
    if (isAPIError(error)) return { ok: false, error: error.message }
    throw error
  }

  revalidatePath('/admin/profiles')
  return { ok: true, data: undefined }
}

export async function updateProfile(id: string, input: unknown): Promise<ActionResult> {
  const admin = await requireRole(['ADMIN'])
  return saveProfile(admin.id, id, input)
}

export async function setRole(id: string, input: unknown): Promise<ActionResult> {
  const admin = await requireRole(['ADMIN'])
  const parsed = setRoleSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Choose a valid role' }
  // Keeps the last admin from locking everyone out by accident.
  if (id === admin.id) return { ok: false, error: 'You cannot change your own role' }

  const user = await db.user.findUnique({ where: { id } })
  if (!user) return { ok: false, error: 'Profile not found' }

  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id }, data: { role: parsed.data } })
    await audit(tx, {
      actorId: admin.id,
      action: 'user.set_role',
      entityType: 'User',
      entityId: id,
      diff: diff(user, { role: parsed.data }),
    })
  })

  revalidatePath('/admin/profiles')
  return { ok: true, data: undefined }
}

/** Deactivating also ends every session the user has, so they are signed out at once. */
export async function setProfileActive(id: string, isActive: boolean): Promise<ActionResult> {
  const admin = await requireRole(['ADMIN'])
  if (id === admin.id) return { ok: false, error: 'You cannot deactivate your own account' }

  const user = await db.user.findUnique({ where: { id } })
  if (!user) return { ok: false, error: 'Profile not found' }

  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id }, data: { isActive } })
    if (!isActive) await tx.session.deleteMany({ where: { userId: id } })
    await audit(tx, {
      actorId: admin.id,
      action: 'user.set_active',
      entityType: 'User',
      entityId: id,
      diff: diff(user, { isActive }),
    })
  })

  revalidatePath('/admin/profiles')
  return { ok: true, data: undefined }
}

/** An admin sets a new password; the old one is not needed. Never logged. */
export async function setPassword(id: string, input: unknown): Promise<ActionResult> {
  const admin = await requireRole(['ADMIN'])
  const parsed = setPasswordSchema.safeParse(input)
  if (!parsed.success) return validationFailed(parsed.error)

  const user = await db.user.findUnique({ where: { id } })
  if (!user) return { ok: false, error: 'Profile not found' }

  const hash = await (await auth.$context).password.hash(parsed.data.password)
  await db.$transaction(async (tx) => {
    await tx.account.updateMany({
      where: { userId: id, providerId: 'credential' },
      data: { password: hash },
    })
    await audit(tx, {
      actorId: admin.id,
      action: 'user.set_password',
      entityType: 'User',
      entityId: id,
    })
  })

  // An admin who resets their own password is signed out, as after changing it on /profile.
  if (id === admin.id) return signOutEverywhere(id)
  return { ok: true, data: undefined }
}

// --- Self ----------------------------------------------------------------------------------

export async function updateOwnProfile(input: unknown): Promise<ActionResult> {
  const user = await requireUser()
  return saveProfile(user.id, user.id, input)
}

/** Requires the current password, then signs the user out everywhere. */
export async function changeOwnPassword(input: unknown): Promise<ActionResult> {
  const user = await requireUser()
  const parsed = changeOwnPasswordSchema.safeParse(input)
  if (!parsed.success) return validationFailed(parsed.error)

  try {
    // Audited by the `/change-password` hook in lib/auth.ts.
    await auth.api.changePassword({
      body: {
        currentPassword: parsed.data.currentPassword,
        newPassword: parsed.data.newPassword,
      },
      headers: await headers(),
    })
  } catch (error) {
    if (isAPIError(error)) {
      return {
        ok: false,
        error: 'Please correct the highlighted fields',
        fieldErrors: { currentPassword: [error.message] },
      }
    }
    throw error
  }

  return signOutEverywhere(user.id)
}

/** Ends this session (clearing its cookie) and every other one, then goes to sign-in. */
async function signOutEverywhere(userId: string): Promise<never> {
  await auth.api.signOut({ headers: await headers() })
  await db.session.deleteMany({ where: { userId } })
  redirect('/sign-in')
}
