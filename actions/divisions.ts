'use server'

import { revalidatePath } from 'next/cache'
import { type ActionResult, validationFailed } from '@/lib/action-result'
import { audit, diff } from '@/lib/audit'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/session'
import { divisionSchema } from '@/schemas/reference'

const codeTaken: ActionResult = {
  ok: false,
  error: 'Please correct the highlighted fields',
  fieldErrors: { code: ['That code is already in use'] },
}

export async function createDivision(input: unknown): Promise<ActionResult> {
  const user = await requireRole(['ADMIN'])
  const parsed = divisionSchema.safeParse(input)
  if (!parsed.success) return validationFailed(parsed.error)

  if (await db.division.findUnique({ where: { code: parsed.data.code } })) return codeTaken

  await db.$transaction(async (tx) => {
    const division = await tx.division.create({ data: parsed.data })
    await audit(tx, {
      actorId: user.id,
      action: 'division.create',
      entityType: 'Division',
      entityId: division.id,
      diff: diff({}, parsed.data),
    })
  })

  revalidatePath('/admin/divisions')
  return { ok: true, data: undefined }
}

export async function updateDivision(id: number, input: unknown): Promise<ActionResult> {
  const user = await requireRole(['ADMIN'])
  const parsed = divisionSchema.safeParse(input)
  if (!parsed.success) return validationFailed(parsed.error)

  const division = await db.division.findUnique({ where: { id } })
  if (!division) return { ok: false, error: 'Division not found' }
  const sameCode = await db.division.findUnique({ where: { code: parsed.data.code } })
  if (sameCode && sameCode.id !== id) return codeTaken

  await db.$transaction(async (tx) => {
    await tx.division.update({ where: { id }, data: parsed.data })
    await audit(tx, {
      actorId: user.id,
      action: 'division.update',
      entityType: 'Division',
      entityId: id,
      diff: diff(division, parsed.data),
    })
  })

  revalidatePath('/admin/divisions')
  return { ok: true, data: undefined }
}

export async function setDivisionActive(id: number, isActive: boolean): Promise<ActionResult> {
  const user = await requireRole(['ADMIN'])

  const division = await db.division.findUnique({ where: { id } })
  if (!division) return { ok: false, error: 'Division not found' }

  await db.$transaction(async (tx) => {
    await tx.division.update({ where: { id }, data: { isActive } })
    await audit(tx, {
      actorId: user.id,
      action: 'division.set_active',
      entityType: 'Division',
      entityId: id,
      diff: diff(division, { isActive }),
    })
  })

  revalidatePath('/admin/divisions')
  return { ok: true, data: undefined }
}
