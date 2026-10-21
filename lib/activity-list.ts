import {
  createLoader,
  type inferParserType,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
} from 'nuqs/server'
import type { Prisma } from '@/generated/prisma/client'
import { ActivityStatus, ActivityType } from '@/generated/prisma/enums'
import { dayRangeFilter, formatRange } from '@/lib/dates'
import { PAGE_SIZE } from '@/lib/search-params'

const day = parseAsString // `yyyy-MM-dd`; anything else is ignored by activityWhere

/** The activity list's search and filters, as they appear in the URL. */
const activityFilters = {
  q: parseAsString.withDefault(''),
  status: parseAsStringLiteral(Object.values(ActivityStatus)),
  type: parseAsStringLiteral(Object.values(ActivityType)),
  virtual: parseAsStringLiteral(['yes', 'no']),
  section: parseAsInteger,
  division: parseAsInteger,
  createdBy: parseAsString,
  from: day,
  to: day,
}
type ActivityFilters = inferParserType<typeof activityFilters>

const loader = createLoader({ ...activityFilters, page: parseAsInteger.withDefault(1) })

/** The filters plus paging. Also accepts a query string (the CSV export sends one). */
export async function loadActivityFilters(
  searchParams: Promise<Record<string, string | string[] | undefined>> | string
) {
  const params = loader(await searchParams)
  const page = Math.max(1, params.page)
  return { ...params, page, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }
}

/**
 * Prisma `where` for the filters. Search covers the title, owner, venue, the creator's names and
 * the section's and division's name and code. `from`/`to` bound the start, in whole days.
 */
export function activityWhere(filters: Partial<ActivityFilters>): Prisma.ActivityWhereInput {
  const contains = (value: string) => ({ contains: value, mode: 'insensitive' as const })
  const { q } = filters
  const start = dayRangeFilter(filters.from, filters.to)

  return {
    ...(filters.status && { status: filters.status }),
    ...(filters.type && { type: filters.type }),
    ...(filters.virtual && { virtual: filters.virtual === 'yes' }),
    ...(filters.section && { sectionId: filters.section }),
    ...(filters.division && { section: { divisionId: filters.division } }),
    ...(filters.createdBy && { createdById: filters.createdBy }),
    ...(start && { start }),
    ...(q && {
      OR: [
        { title: contains(q) },
        { owner: contains(q) },
        { venue: contains(q) },
        { createdBy: { name: contains(q) } },
        { section: { name: contains(q) } },
        { section: { code: contains(q) } },
        { section: { division: { name: contains(q) } } },
        { section: { division: { code: contains(q) } } },
      ],
    }),
  }
}

/** Newest first, as every activity list orders (the review queue defaults to oldest first). */
export const activityOrder: Prisma.ActivityOrderByWithRelationInput[] = [
  { createdAt: 'desc' },
  { id: 'desc' },
]

export const activityRowInclude = {
  section: { select: { code: true } },
  createdBy: { select: { name: true } },
} satisfies Prisma.ActivityInclude

/** What `ActivitiesTable` shows, formatted on the server in APP_TIMEZONE. */
export function toActivityRow(
  activity: Prisma.ActivityGetPayload<{ include: typeof activityRowInclude }>
) {
  return {
    id: activity.id,
    title: activity.title,
    venue: activity.venue,
    when: formatRange(activity.start, activity.end, activity.allDay),
    section: activity.section.code,
    createdBy: activity.createdBy.name,
    status: activity.status,
  }
}
