'use server'

import { revalidatePath } from 'next/cache'
import { type ActionResult, validationFailed } from '@/lib/action-result'
import { audit, diff } from '@/lib/audit'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/session'
import { lguSchema } from '@/schemas/reference'

const noProvince: ActionResult = {
  ok: false,
  error: 'Please correct the highlighted fields',
  fieldErrors: { provinceId: ['Choose a province'] },
}

// Provinces are not a table of their own; their names come from the seeded LGUs.
async function provinceName(provinceId: number) {
  const lgu = await db.lgu.findFirst({ where: { provinceId }, select: { province: true } })
  return lgu?.province
}

export async function createLgu(input: unknown): Promise<ActionResult> {
  const user = await requireRole(['ADMIN'])
  const parsed = lguSchema.safeParse(input)
  if (!parsed.success) return validationFailed(parsed.error)

  if (await db.lgu.findUnique({ where: { id: parsed.data.id } })) {
    return {
      ok: false,
      error: 'Please correct the highlighted fields',
      fieldErrors: { id: ['An LGU with that PSGC code already exists'] },
    }
  }
  const province = await provinceName(parsed.data.provinceId)
  if (!province) return noProvince

  const data = { ...parsed.data, province }
  await db.$transaction(async (tx) => {
    await tx.lgu.create({ data })
    await audit(tx, {
      actorId: user.id,
      action: 'lgu.create',
      entityType: 'Lgu',
      entityId: data.id,
      diff: diff({}, data),
    })
  })

  revalidatePath('/admin/lgus')
  return { ok: true, data: undefined }
}

/** The PSGC code is the key and cannot change; only the name and province can. */
export async function updateLgu(id: string, input: unknown): Promise<ActionResult> {
  const user = await requireRole(['ADMIN'])
  const parsed = lguSchema.omit({ id: true }).safeParse(input)
  if (!parsed.success) return validationFailed(parsed.error)

  const lgu = await db.lgu.findUnique({ where: { id } })
  if (!lgu) return { ok: false, error: 'LGU not found' }
  const province = await provinceName(parsed.data.provinceId)
  if (!province) return noProvince

  const data = { ...parsed.data, province }
  await db.$transaction(async (tx) => {
    await tx.lgu.update({ where: { id }, data })
    await audit(tx, {
      actorId: user.id,
      action: 'lgu.update',
      entityType: 'Lgu',
      entityId: id,
      diff: diff(lgu, data),
    })
  })

  revalidatePath('/admin/lgus')
  return { ok: true, data: undefined }
}

export async function setLguActive(id: string, isActive: boolean): Promise<ActionResult> {
  const user = await requireRole(['ADMIN'])

  const lgu = await db.lgu.findUnique({ where: { id } })
  if (!lgu) return { ok: false, error: 'LGU not found' }

  await db.$transaction(async (tx) => {
    await tx.lgu.update({ where: { id }, data: { isActive } })
    await audit(tx, {
      actorId: user.id,
      action: 'lgu.set_active',
      entityType: 'Lgu',
      entityId: id,
      diff: diff(lgu, { isActive }),
    })
  })

  revalidatePath('/admin/lgus')
  return { ok: true, data: undefined }
}
