// Who may do what to an activity. Pure, so every rule is unit-tested without a database; the
// actions call these and the pages use them to decide which buttons to show.
import type { ActivityStatus, Role } from '@/generated/prisma/enums'

type Actor = { id: string; role: Role }
type ActivityLike = { createdById: string; status: ActivityStatus }

/** Statuses a reviewer can set; each needs the activity to be PENDING. */
export const REVIEW_DECISIONS = [
  'APPROVED',
  'RETURNED',
  'REJECTED',
] as const satisfies ActivityStatus[]

/** Decisions that must say why (max 2000 characters). */
export const NOTE_REQUIRED: ActivityStatus[] = ['RETURNED', 'REJECTED', 'CANCELLED']

const isCreator = (user: Actor, activity: ActivityLike) => activity.createdById === user.id
const isReviewer = (user: Actor) => user.role === 'ADMIN' || user.role === 'MANAGER'

/** Creator or admin, and never once REJECTED or CANCELLED. */
export function canEdit(user: Actor, activity: ActivityLike) {
  if (activity.status === 'REJECTED' || activity.status === 'CANCELLED') return false
  return isCreator(user, activity) || user.role === 'ADMIN'
}

/** Admin or manager (their own activities too), only while PENDING. */
export function canReview(user: Actor, activity: ActivityLike) {
  return isReviewer(user) && activity.status === 'PENDING'
}

/** Creator from PENDING/RETURNED; admin also from APPROVED. */
export function canCancel(user: Actor, activity: ActivityLike) {
  if (user.role === 'ADMIN') return ['PENDING', 'RETURNED', 'APPROVED'].includes(activity.status)
  return isCreator(user, activity) && ['PENDING', 'RETURNED'].includes(activity.status)
}

/** The status changes `user` may make through the status dialog. */
export function allowedTransitions(user: Actor, activity: ActivityLike): ActivityStatus[] {
  return [
    ...(canReview(user, activity) ? REVIEW_DECISIONS : []),
    ...(canCancel(user, activity) ? (['CANCELLED'] as const) : []),
  ]
}

/**
 * The status an edit leaves behind. The edit form never sets a status; these are the only
 * implicit changes: a RETURNED activity is resubmitted, and a non-admin editing an APPROVED one
 * sends it back for review.
 */
export function statusAfterEdit(user: Actor, activity: ActivityLike): ActivityStatus {
  if (activity.status === 'RETURNED') return 'PENDING'
  if (activity.status === 'APPROVED' && user.role !== 'ADMIN') return 'PENDING'
  return activity.status
}
