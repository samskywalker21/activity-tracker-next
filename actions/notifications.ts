'use server'

import type { Prisma } from '@/generated/prisma/client'
import type { ActivityStatus, Role } from '@/generated/prisma/enums'
import type { ActionResult } from '@/lib/action-result'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/session'

// Notifications are derived from ActivityEvent and Comment rows, never stored. One row is one
// notification however many reasons it has to appear, so nothing is listed twice.

export type Notification = {
  key: string
  activityId: number
  activityTitle: string
  actor: string
  /** The status it moved to; null for a comment. */
  status: ActivityStatus | null
  /** What happened, e.g. "returned" or "commented on". */
  verb: string
  /** The reason given, or the comment. */
  quote: string | null
  createdAt: Date
}

type Viewer = { id: string; role: Role }

const isReviewer = (user: Viewer) => user.role === 'ADMIN' || user.role === 'MANAGER'

/**
 * Status changes by others on the viewer's own activities; for reviewers also every submission,
 * resubmission (anything → PENDING) and cancellation.
 */
function eventWhere(user: Viewer): Prisma.ActivityEventWhereInput {
  return {
    actorId: { not: user.id },
    OR: [
      { activity: { createdById: user.id } },
      ...(isReviewer(user)
        ? [{ toStatus: { in: ['PENDING', 'CANCELLED'] as ActivityStatus[] } }]
        : []),
    ],
  }
}

/** Comments by others on the viewer's own activities; for reviewers also on pending ones. */
function commentWhere(user: Viewer): Prisma.CommentWhereInput {
  return {
    authorId: { not: user.id },
    OR: [
      { activity: { createdById: user.id } },
      ...(isReviewer(user) ? [{ activity: { status: 'PENDING' as const } }] : []),
    ],
  }
}

/** Read from the database: the session's copy only refreshes on sign-in. */
async function seenAt(userId: string) {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { notificationsSeenAt: true },
  })
  return user.notificationsSeenAt
}

/** How many notifications are newer than the last time the bell was opened. Polled by the bell. */
export async function getUnreadCount(): Promise<ActionResult<{ count: number; seenAt: Date }>> {
  const user = await requireUser()
  const since = await seenAt(user.id)
  const newer = { createdAt: { gt: since } }

  const [events, comments] = await Promise.all([
    db.activityEvent.count({ where: { ...eventWhere(user), ...newer } }),
    db.comment.count({ where: { ...commentWhere(user), ...newer } }),
  ])
  return { ok: true, data: { count: events + comments, seenAt: since } }
}

const verbs: Record<ActivityStatus, string> = {
  PENDING: 'resubmitted',
  APPROVED: 'approved',
  RETURNED: 'returned',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
}

const LIMIT = 20

/** The latest 20 notifications, newest first. Reading them does not mark them seen. */
export async function getNotifications(): Promise<ActionResult<Notification[]>> {
  const user = await requireUser()
  const activity = { select: { id: true, title: true } }

  const [events, comments] = await Promise.all([
    db.activityEvent.findMany({
      where: eventWhere(user),
      include: { activity, actor: { select: { name: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: LIMIT,
    }),
    db.comment.findMany({
      where: commentWhere(user),
      include: { activity, author: { select: { name: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: LIMIT,
    }),
  ])

  const notifications: Notification[] = [
    ...events.map((event) => ({
      key: `event-${event.id}`,
      activityId: event.activity.id,
      activityTitle: event.activity.title,
      actor: event.actor.name,
      status: event.toStatus,
      verb: event.fromStatus ? verbs[event.toStatus] : 'submitted',
      quote: event.note,
      createdAt: event.createdAt,
    })),
    ...comments.map((comment) => ({
      key: `comment-${comment.id}`,
      activityId: comment.activity.id,
      activityTitle: comment.activity.title,
      actor: comment.author.name,
      status: null,
      verb: 'commented on',
      quote: comment.body,
      createdAt: comment.createdAt,
    })),
  ]
  notifications.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  return { ok: true, data: notifications.slice(0, LIMIT) }
}

/**
 * Marks everything so far as seen. Not audited: it is the bell's read marker, not a change to
 * anything anyone else sees.
 */
export async function markNotificationsSeen(): Promise<ActionResult> {
  const user = await requireUser()
  await db.user.update({ where: { id: user.id }, data: { notificationsSeenAt: new Date() } })
  return { ok: true, data: undefined }
}
