'use server'

import { revalidatePath } from 'next/cache'
import { type ActionResult, validationFailed } from '@/lib/action-result'
import { audit, diff } from '@/lib/audit'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/session'
import { commentSchema } from '@/schemas/activities'

export async function addComment(activityId: number, input: unknown): Promise<ActionResult> {
  const user = await requireUser()
  const parsed = commentSchema.safeParse(input)
  if (!parsed.success) return validationFailed(parsed.error)

  const activity = await db.activity.findUnique({ where: { id: activityId } })
  if (!activity) return { ok: false, error: 'Activity not found' }

  await db.$transaction(async (tx) => {
    const comment = await tx.comment.create({
      data: { activityId, authorId: user.id, body: parsed.data.body },
    })
    await audit(tx, {
      actorId: user.id,
      action: 'comment.create',
      entityType: 'Comment',
      entityId: comment.id,
      diff: diff({}, { activityId, body: comment.body }),
    })
  })

  revalidatePath(`/activities/${activityId}`)
  return { ok: true, data: undefined }
}

export async function updateComment(id: number, input: unknown): Promise<ActionResult> {
  const user = await requireUser()
  const parsed = commentSchema.safeParse(input)
  if (!parsed.success) return validationFailed(parsed.error)

  const comment = await db.comment.findUnique({ where: { id } })
  if (!comment) return { ok: false, error: 'Comment not found' }
  if (comment.authorId !== user.id) {
    return { ok: false, error: 'You can only edit your own comments' }
  }

  await db.$transaction(async (tx) => {
    await tx.comment.update({ where: { id }, data: parsed.data })
    await audit(tx, {
      actorId: user.id,
      action: 'comment.update',
      entityType: 'Comment',
      entityId: id,
      diff: diff(comment, parsed.data),
    })
  })

  revalidatePath(`/activities/${comment.activityId}`)
  return { ok: true, data: undefined }
}

export async function deleteComment(id: number): Promise<ActionResult> {
  const user = await requireUser()

  const comment = await db.comment.findUnique({ where: { id } })
  if (!comment) return { ok: false, error: 'Comment not found' }
  if (comment.authorId !== user.id) {
    return { ok: false, error: 'You can only delete your own comments' }
  }

  await db.$transaction(async (tx) => {
    await tx.comment.delete({ where: { id } })
    await audit(tx, {
      actorId: user.id,
      action: 'comment.delete',
      entityType: 'Comment',
      entityId: id,
      diff: diff(comment, { body: null }),
    })
  })

  revalidatePath(`/activities/${comment.activityId}`)
  return { ok: true, data: undefined }
}
