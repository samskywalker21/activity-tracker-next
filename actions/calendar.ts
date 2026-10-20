'use server'

import type { ActivityStatus, ActivityType } from '@/generated/prisma/enums'
import { type ActionResult, validationFailed } from '@/lib/action-result'
import { activityWhere } from '@/lib/activity-list'
import { formatDay, formatRange } from '@/lib/dates'
import { db } from '@/lib/db'
import { CALENDAR_STATUSES } from '@/lib/rules'
import { type CalendarRangeInput, calendarRangeSchema } from '@/schemas/activities'

/** Display-ready, formatted in APP_TIMEZONE; the days are `yyyy-MM-dd`. */
export type CalendarActivity = {
  id: number
  title: string
  type: ActivityType
  status: ActivityStatus
  venue: string
  section: string
  when: string
  startDay: string
  endDay: string
}

/** The public calendar's feed, open to guests: approved and pending activities overlapping the window. */
export async function getCalendarRange(
  input: CalendarRangeInput
): Promise<ActionResult<CalendarActivity[]>> {
  const parsed = calendarRangeSchema.safeParse(input)
  if (!parsed.success) return validationFailed(parsed.error)
  const { start, end, status, ...filters } = parsed.data

  const activities = await db.activity.findMany({
    where: {
      ...activityWhere(filters),
      status: status ?? { in: [...CALENDAR_STATUSES] },
      start: { lte: end },
      end: { gte: start },
    },
    include: { section: { select: { code: true } } },
    orderBy: [{ start: 'asc' }, { id: 'asc' }],
  })

  return {
    ok: true,
    data: activities.map((activity) => ({
      id: activity.id,
      title: activity.title,
      type: activity.type,
      status: activity.status,
      venue: activity.venue,
      section: activity.section.code,
      when: formatRange(activity.start, activity.end, activity.allDay),
      startDay: formatDay(activity.start),
      endDay: formatDay(activity.end),
    })),
  }
}
