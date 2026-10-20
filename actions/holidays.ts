'use server'

import { revalidatePath } from 'next/cache'
import { type ActionResult, validationFailed } from '@/lib/action-result'
import { audit, diff } from '@/lib/audit'
import { dayBounds, parseDay } from '@/lib/dates'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/session'
import { holidaySchema } from '@/schemas/reference'

export async function createHoliday(input: unknown): Promise<ActionResult> {
  const user = await requireRole(['ADMIN', 'MANAGER'])
  const parsed = holidaySchema.safeParse(input)
  if (!parsed.success) return validationFailed(parsed.error)

  // Holidays are whole days in APP_TIMEZONE.
  const data = {
    name: parsed.data.name,
    ...dayBounds(parseDay(parsed.data.start), parseDay(parsed.data.end)),
  }

  await db.$transaction(async (tx) => {
    const holiday = await tx.holiday.create({ data })
    await audit(tx, {
      actorId: user.id,
      action: 'holiday.create',
      entityType: 'Holiday',
      entityId: holiday.id,
      diff: diff({}, data),
    })
  })

  revalidatePath('/manage/holidays')
  return { ok: true, data: undefined }
}

export async function deleteHoliday(id: number): Promise<ActionResult> {
  const user = await requireRole(['ADMIN', 'MANAGER'])

  const holiday = await db.holiday.findUnique({ where: { id } })
  if (!holiday) return { ok: false, error: 'Holiday not found' }

  await db.$transaction(async (tx) => {
    await tx.holiday.delete({ where: { id } })
    await audit(tx, {
      actorId: user.id,
      action: 'holiday.delete',
      entityType: 'Holiday',
      entityId: id,
      diff: diff(holiday, { name: null, start: null, end: null }),
    })
  })

  revalidatePath('/manage/holidays')
  return { ok: true, data: undefined }
}

export async function updateHoliday(id: number, input: unknown): Promise<ActionResult> {
  const user = await requireRole(['ADMIN', 'MANAGER'])
  const parsed = holidaySchema.safeParse(input)
  if (!parsed.success) return validationFailed(parsed.error)

  const holiday = await db.holiday.findUnique({ where: { id } })
  if (!holiday) return { ok: false, error: 'Holiday not found' }

  const data = {
    name: parsed.data.name,
    ...dayBounds(parseDay(parsed.data.start), parseDay(parsed.data.end)),
  }

  await db.$transaction(async (tx) => {
    await tx.holiday.update({ where: { id }, data })
    await audit(tx, {
      actorId: user.id,
      action: 'holiday.update',
      entityType: 'Holiday',
      entityId: id,
      diff: diff(holiday, data),
    })
  })

  revalidatePath('/manage/holidays')
  return { ok: true, data: undefined }
}
