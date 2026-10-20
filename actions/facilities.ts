'use server'

import { revalidatePath } from 'next/cache'
import { type ActionResult, validationFailed } from '@/lib/action-result'
import { audit, diff } from '@/lib/audit'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/session'
import { facilitySchema } from '@/schemas/reference'

export async function createFacility(input: unknown): Promise<ActionResult> {
  const user = await requireRole(['ADMIN', 'MANAGER'])
  const parsed = facilitySchema.safeParse(input)
  if (!parsed.success) return validationFailed(parsed.error)

  await db.$transaction(async (tx) => {
    const facility = await tx.facility.create({ data: parsed.data })
    await audit(tx, {
      actorId: user.id,
      action: 'facility.create',
      entityType: 'Facility',
      entityId: facility.id,
      diff: diff({}, parsed.data),
    })
  })

  revalidatePath('/manage/facilities')
  return { ok: true, data: undefined }
}

export async function updateFacility(id: number, input: unknown): Promise<ActionResult> {
  const user = await requireRole(['ADMIN', 'MANAGER'])
  const parsed = facilitySchema.safeParse(input)
  if (!parsed.success) return validationFailed(parsed.error)

  const facility = await db.facility.findUnique({ where: { id } })
  if (!facility) return { ok: false, error: 'Facility not found' }

  await db.$transaction(async (tx) => {
    await tx.facility.update({ where: { id }, data: parsed.data })
    await audit(tx, {
      actorId: user.id,
      action: 'facility.update',
      entityType: 'Facility',
      entityId: id,
      diff: diff(facility, parsed.data),
    })
  })

  revalidatePath('/manage/facilities')
  return { ok: true, data: undefined }
}

export async function setFacilityActive(id: number, isActive: boolean): Promise<ActionResult> {
  const user = await requireRole(['ADMIN', 'MANAGER'])

  const facility = await db.facility.findUnique({ where: { id } })
  if (!facility) return { ok: false, error: 'Facility not found' }

  await db.$transaction(async (tx) => {
    await tx.facility.update({ where: { id }, data: { isActive } })
    await audit(tx, {
      actorId: user.id,
      action: 'facility.set_active',
      entityType: 'Facility',
      entityId: id,
      diff: diff(facility, { isActive }),
    })
  })

  revalidatePath('/manage/facilities')
  return { ok: true, data: undefined }
}
