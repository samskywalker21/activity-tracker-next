'use server'

import { revalidatePath } from 'next/cache'
import { type ActionResult, validationFailed } from '@/lib/action-result'
import { audit, diff } from '@/lib/audit'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/session'
import { sectionSchema } from '@/schemas/reference'

const codeTaken: ActionResult = {
  ok: false,
  error: 'Please correct the highlighted fields',
  fieldErrors: { code: ['That code is already in use'] },
}

const noDivision: ActionResult = {
  ok: false,
  error: 'Please correct the highlighted fields',
  fieldErrors: { divisionId: ['Choose a division'] },
}

export async function createSection(input: unknown): Promise<ActionResult> {
  const user = await requireRole(['ADMIN'])
  const parsed = sectionSchema.safeParse(input)
  if (!parsed.success) return validationFailed(parsed.error)

  if (await db.section.findUnique({ where: { code: parsed.data.code } })) return codeTaken
  const division = await db.division.findUnique({ where: { id: parsed.data.divisionId } })
  if (!division?.isActive) return noDivision

  await db.$transaction(async (tx) => {
    const section = await tx.section.create({ data: parsed.data })
    await audit(tx, {
      actorId: user.id,
      action: 'section.create',
      entityType: 'Section',
      entityId: section.id,
      diff: diff({}, parsed.data),
    })
  })

  revalidatePath('/admin/sections')
  return { ok: true, data: undefined }
}

export async function updateSection(id: number, input: unknown): Promise<ActionResult> {
  const user = await requireRole(['ADMIN'])
  const parsed = sectionSchema.safeParse(input)
  if (!parsed.success) return validationFailed(parsed.error)

  const section = await db.section.findUnique({ where: { id } })
  if (!section) return { ok: false, error: 'Section not found' }
  const sameCode = await db.section.findUnique({ where: { code: parsed.data.code } })
  if (sameCode && sameCode.id !== id) return codeTaken
  // Keeping an existing (now inactive) division is fine; moving to one is not.
  if (parsed.data.divisionId !== section.divisionId) {
    const division = await db.division.findUnique({ where: { id: parsed.data.divisionId } })
    if (!division?.isActive) return noDivision
  }

  await db.$transaction(async (tx) => {
    await tx.section.update({ where: { id }, data: parsed.data })
    await audit(tx, {
      actorId: user.id,
      action: 'section.update',
      entityType: 'Section',
      entityId: id,
      diff: diff(section, parsed.data),
    })
  })

  revalidatePath('/admin/sections')
  return { ok: true, data: undefined }
}

export async function setSectionActive(id: number, isActive: boolean): Promise<ActionResult> {
  const user = await requireRole(['ADMIN'])

  const section = await db.section.findUnique({ where: { id } })
  if (!section) return { ok: false, error: 'Section not found' }

  await db.$transaction(async (tx) => {
    await tx.section.update({ where: { id }, data: { isActive } })
    await audit(tx, {
      actorId: user.id,
      action: 'section.set_active',
      entityType: 'Section',
      entityId: id,
      diff: diff(section, { isActive }),
    })
  })

  revalidatePath('/admin/sections')
  return { ok: true, data: undefined }
}
