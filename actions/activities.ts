'use server'

import { revalidatePath } from 'next/cache'
import type { Prisma } from '@/generated/prisma/client'
import { type ActionResult, validationFailed } from '@/lib/action-result'
import { activityWhere, loadActivityFilters } from '@/lib/activity-list'
import { audit, diff } from '@/lib/audit'
import type { Conflicts } from '@/lib/conflicts'
import { formatDay, formatTime } from '@/lib/dates'
import { db } from '@/lib/db'
import { findConflicts } from '@/lib/find-conflicts'
import { allowedTransitions, canEdit, REVIEW_DECISIONS, statusAfterEdit } from '@/lib/rules'
import { requireUser } from '@/lib/session'
import { statusLabels, typeLabels } from '@/lib/status'
import {
  type ActivityInput,
  activitySchema,
  conflictCheckSchema,
  rangeToDates,
  statusChangeSchema,
} from '@/schemas/activities'

/** The scalar columns a form submission sets; blank optional text is stored as null. */
function activityData(input: ActivityInput) {
  return {
    title: input.title,
    type: input.type,
    virtual: input.virtual,
    allDay: input.allDay,
    ...rangeToDates(input),
    sectionId: input.sectionId,
    owner: input.owner,
    venue: input.venue,
    prNo: input.prNo || null,
    otherParticipants: input.otherParticipants || null,
    otherLgu: input.otherLgu || null,
    otherFacilities: input.otherFacilities || null,
    remarks: input.remarks || null,
  }
}

const noSection: Extract<ActionResult, { ok: false }> = {
  ok: false,
  error: 'Please correct the highlighted fields',
  fieldErrors: { sectionId: ['Choose a section'] },
}

async function sectionIsActive(sectionId: number) {
  const section = await db.section.findUnique({ where: { id: sectionId } })
  return section?.isActive === true
}

const pivotIds = {
  participants: { select: { id: true } },
  lgus: { select: { id: true } },
  facilities: { select: { id: true } },
} satisfies Prisma.ActivityInclude

export async function createActivity(input: unknown): Promise<ActionResult<{ id: number }>> {
  const user = await requireUser()
  const parsed = activitySchema.safeParse(input)
  if (!parsed.success) return validationFailed(parsed.error)
  if (!(await sectionIsActive(parsed.data.sectionId))) return noSection

  const { participantIds, lguIds, facilityIds } = parsed.data
  const data = activityData(parsed.data)

  const activity = await db.$transaction(async (tx) => {
    const activity = await tx.activity.create({
      data: {
        ...data,
        createdById: user.id,
        updatedById: user.id,
        participants: { connect: participantIds.map((id) => ({ id })) },
        lgus: { connect: lguIds.map((id) => ({ id })) },
        facilities: { connect: facilityIds.map((id) => ({ id })) },
        events: { create: { actorId: user.id, fromStatus: null, toStatus: 'PENDING' } },
      },
    })
    await audit(tx, {
      actorId: user.id,
      action: 'activity.create',
      entityType: 'Activity',
      entityId: activity.id,
      diff: diff({}, { ...data, status: 'PENDING', participantIds, lguIds, facilityIds }),
    })
    return activity
  })

  revalidatePath('/', 'layout')
  return { ok: true, data: { id: activity.id } }
}

export async function updateActivity(id: number, input: unknown): Promise<ActionResult> {
  const user = await requireUser()
  const parsed = activitySchema.safeParse(input)
  if (!parsed.success) return validationFailed(parsed.error)

  const activity = await db.activity.findUnique({ where: { id }, include: pivotIds })
  if (!activity) return { ok: false, error: 'Activity not found' }
  if (!canEdit(user, activity)) return { ok: false, error: 'You cannot edit this activity' }
  // Keeping a section that has since been deactivated is fine; moving to one is not.
  if (
    parsed.data.sectionId !== activity.sectionId &&
    !(await sectionIsActive(parsed.data.sectionId))
  ) {
    return noSection
  }

  const { participantIds, lguIds, facilityIds } = parsed.data
  const data = { ...activityData(parsed.data), status: statusAfterEdit(user, activity) }

  await db.$transaction(async (tx) => {
    await tx.activity.update({
      where: { id },
      data: {
        ...data,
        updatedById: user.id,
        participants: { set: participantIds.map((id) => ({ id })) },
        lgus: { set: lguIds.map((id) => ({ id })) },
        facilities: { set: facilityIds.map((id) => ({ id })) },
      },
    })
    if (data.status !== activity.status) {
      await tx.activityEvent.create({
        data: {
          activityId: id,
          actorId: user.id,
          fromStatus: activity.status,
          toStatus: data.status,
        },
      })
    }
    await audit(tx, {
      actorId: user.id,
      action: 'activity.update',
      entityType: 'Activity',
      entityId: id,
      diff: diff(
        {
          ...activity,
          participantIds: activity.participants.map((p) => p.id),
          lguIds: activity.lgus.map((l) => l.id),
          facilityIds: activity.facilities.map((f) => f.id),
        },
        { ...data, participantIds, lguIds, facilityIds }
      ),
    })
  })

  revalidatePath('/', 'layout')
  return { ok: true, data: undefined }
}

export async function changeStatus(id: number, input: unknown): Promise<ActionResult> {
  const user = await requireUser()
  const parsed = statusChangeSchema.safeParse(input)
  if (!parsed.success) return validationFailed(parsed.error)

  const activity = await db.activity.findUnique({ where: { id } })
  if (!activity) return { ok: false, error: 'Activity not found' }

  const { status, note } = parsed.data
  if (!allowedTransitions(user, activity).includes(status)) {
    const review = (REVIEW_DECISIONS as readonly string[]).includes(status)
    return {
      ok: false,
      error:
        review && activity.status !== 'PENDING'
          ? 'Only a pending activity can be reviewed'
          : 'You do not have permission to do that',
    }
  }

  await db.$transaction(async (tx) => {
    await tx.activity.update({ where: { id }, data: { status, updatedById: user.id } })
    await tx.activityEvent.create({
      data: {
        activityId: id,
        actorId: user.id,
        fromStatus: activity.status,
        toStatus: status,
        note: note || null,
      },
    })
    await audit(tx, {
      actorId: user.id,
      action: 'activity.status',
      entityType: 'Activity',
      entityId: id,
      diff: diff(activity, { status }),
      meta: note ? { note } : undefined,
    })
  })

  revalidatePath('/', 'layout')
  return { ok: true, data: undefined }
}

/** The form's live conflict check: a warning, never a block. */
export async function checkConflicts(input: unknown): Promise<ActionResult<Conflicts>> {
  await requireUser()
  const parsed = conflictCheckSchema.safeParse(input)
  if (!parsed.success) return validationFailed(parsed.error)

  return { ok: true, data: await findConflicts({ ...parsed.data, ...rangeToDates(parsed.data) }) }
}

/** RFC 4180: quote every field, double any quote inside it. */
const csvField = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`
/** Wall-clock time in APP_TIMEZONE, the zone the activities were entered in. */
const csvStamp = (date: Date) => `${formatDay(date)} ${formatTime(date)}`

/**
 * The activities matching the list's search and filters (`query` is its query string), every
 * page, ordered by start, as CSV text. The browser adds the BOM Excel needs to read it as UTF-8.
 */
export async function exportActivities(query: string): Promise<ActionResult<string>> {
  await requireUser()
  const filters = await loadActivityFilters(query)

  const activities = await db.activity.findMany({
    where: activityWhere(filters),
    orderBy: [{ start: 'asc' }, { id: 'asc' }],
    include: {
      section: { include: { division: true } },
      createdBy: { select: { name: true } },
      participants: { select: { name: true }, orderBy: { name: 'asc' } },
      lgus: { select: { muncity: true }, orderBy: { muncity: 'asc' } },
      facilities: { select: { name: true }, orderBy: { name: 'asc' } },
    },
  })

  const header = [
    'ID',
    'Title',
    'Type',
    'Status',
    'Start',
    'End',
    'All day',
    'Virtual',
    'Venue',
    'Owner',
    'Section',
    'Division',
    'Participants',
    'LGUs',
    'Facilities',
    'Other participants',
    'Other LGUs',
    'Other facilities',
    'Others',
    'PR No.',
    'Remarks',
    'Created by',
  ]
  const lines = activities.map((a) =>
    [
      a.id,
      a.title,
      typeLabels[a.type],
      statusLabels[a.status],
      csvStamp(a.start),
      csvStamp(a.end),
      a.allDay ? 'Yes' : 'No',
      a.virtual ? 'Yes' : 'No',
      a.venue,
      a.owner,
      a.section.name,
      a.section.division.name,
      a.participants.map((p) => p.name).join('; '),
      a.lgus.map((l) => l.muncity).join('; '),
      a.facilities.map((f) => f.name).join('; '),
      a.otherParticipants,
      a.otherLgu,
      a.otherFacilities,
      a.others,
      a.prNo,
      a.remarks,
      a.createdBy.name,
    ]
      .map(csvField)
      .join(',')
  )

  return { ok: true, data: `${[header.map(csvField).join(','), ...lines].join('\r\n')}\r\n` }
}
