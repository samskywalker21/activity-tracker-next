import type { Prisma } from '@/generated/prisma/client'
import type { Conflicts } from '@/lib/conflicts'
import { db } from '@/lib/db'

type ConflictQuery = {
  /** The activity being checked, left out of its own results. */
  id?: number
  start: Date
  end: Date
  participantIds: number[]
  lguIds: string[]
  facilityIds: number[]
}

/**
 * What overlaps a range: for the form's live check and the activity page. A bucket whose
 * selection is empty is `[]` without a query, so "nothing selected" is not "no clash".
 */
export async function findConflicts(query: ConflictQuery): Promise<Conflicts> {
  const { id, start, end, participantIds, lguIds, facilityIds } = query
  const overlapping: Prisma.ActivityWhereInput = {
    start: { lte: end },
    end: { gte: start },
    // Rejected and cancelled activities are not going to happen, so they cannot clash.
    status: { notIn: ['REJECTED', 'CANCELLED'] },
    ...(id !== undefined && { id: { not: id } }),
  }
  const find = (shared?: Prisma.ActivityWhereInput) =>
    db.activity.findMany({
      where: { ...overlapping, ...shared },
      select: { id: true, title: true, start: true, end: true, allDay: true, status: true },
      orderBy: { start: 'asc' },
    })

  const [date, participants, lgus, facilities, holidays] = await Promise.all([
    find(),
    participantIds.length ? find({ participants: { some: { id: { in: participantIds } } } }) : [],
    lguIds.length ? find({ lgus: { some: { id: { in: lguIds } } } }) : [],
    facilityIds.length ? find({ facilities: { some: { id: { in: facilityIds } } } }) : [],
    db.holiday.findMany({
      where: { start: { lte: end }, end: { gte: start } },
      select: { id: true, name: true, start: true, end: true },
      orderBy: { start: 'asc' },
    }),
  ])

  return { date, participants, lgus, facilities, holidays }
}
