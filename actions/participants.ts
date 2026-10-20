'use server'

import { revalidatePath } from 'next/cache'
import { type ActionResult, validationFailed } from '@/lib/action-result'
import { audit, diff } from '@/lib/audit'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/session'
import { participantSchema } from '@/schemas/reference'

export async function createParticipant(input: unknown): Promise<ActionResult> {
  const user = await requireRole(['ADMIN', 'MANAGER'])
  const parsed = participantSchema.safeParse(input)
  if (!parsed.success) return validationFailed(parsed.error)

  await db.$transaction(async (tx) => {
    const participant = await tx.participant.create({ data: parsed.data })
    await audit(tx, {
      actorId: user.id,
      action: 'participant.create',
      entityType: 'Participant',
      entityId: participant.id,
      diff: diff({}, parsed.data),
    })
  })

  revalidatePath('/manage/participants')
  return { ok: true, data: undefined }
}

export async function updateParticipant(id: number, input: unknown): Promise<ActionResult> {
  const user = await requireRole(['ADMIN', 'MANAGER'])
  const parsed = participantSchema.safeParse(input)
  if (!parsed.success) return validationFailed(parsed.error)

  const participant = await db.participant.findUnique({ where: { id } })
  if (!participant) return { ok: false, error: 'Participant not found' }

  await db.$transaction(async (tx) => {
    await tx.participant.update({ where: { id }, data: parsed.data })
    await audit(tx, {
      actorId: user.id,
      action: 'participant.update',
      entityType: 'Participant',
      entityId: id,
      diff: diff(participant, parsed.data),
    })
  })

  revalidatePath('/manage/participants')
  return { ok: true, data: undefined }
}

export async function setParticipantActive(id: number, isActive: boolean): Promise<ActionResult> {
  const user = await requireRole(['ADMIN', 'MANAGER'])

  const participant = await db.participant.findUnique({ where: { id } })
  if (!participant) return { ok: false, error: 'Participant not found' }

  await db.$transaction(async (tx) => {
    await tx.participant.update({ where: { id }, data: { isActive } })
    await audit(tx, {
      actorId: user.id,
      action: 'participant.set_active',
      entityType: 'Participant',
      entityId: id,
      diff: diff(participant, { isActive }),
    })
  })

  revalidatePath('/manage/participants')
  return { ok: true, data: undefined }
}
