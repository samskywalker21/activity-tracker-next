import { createLoader, parseAsStringLiteral } from 'nuqs/server'
import { ActivitiesTable } from '@/components/activities/activities-table'
import { FilterBar, SearchFilter, SelectFilter, TabsFilter } from '@/components/filter-bar'
import { NoResults } from '@/components/no-results'
import { PageHeader } from '@/components/page-header'
import { PaginationBar } from '@/components/pagination-bar'
import { ActivityType } from '@/generated/prisma/enums'
import {
  activityOrder,
  activityRowInclude,
  activityWhere,
  loadActivityFilters,
  toActivityRow,
} from '@/lib/activity-list'
import { db } from '@/lib/db'
import { PAGE_SIZE } from '@/lib/search-params'
import { requireRole } from '@/lib/session'
import { typeLabels } from '@/lib/status'

// First come, first served by default.
const loadSort = createLoader({
  sort: parseAsStringLiteral(['oldest', 'newest']).withDefault('oldest'),
})

const typeItems = Object.values(ActivityType).map((t) => ({ value: t, label: typeLabels[t] }))

export default async function ReviewPage({ searchParams }: PageProps<'/review'>) {
  await requireRole(['ADMIN', 'MANAGER'])
  const filters = await loadActivityFilters(searchParams)
  const { sort } = loadSort(await searchParams)

  const where = activityWhere({ ...filters, status: 'PENDING' })
  const [activities, total, sections] = await Promise.all([
    db.activity.findMany({
      where,
      include: activityRowInclude,
      orderBy: sort === 'newest' ? activityOrder : [{ createdAt: 'asc' }, { id: 'asc' }],
      skip: filters.skip,
      take: filters.take,
    }),
    db.activity.count({ where }),
    db.section.findMany({ orderBy: { code: 'asc' } }),
  ])

  return (
    <>
      <PageHeader
        title="Review"
        description="Pending activities waiting for a decision. Open one to approve, return or reject it."
      />
      <FilterBar>
        <TabsFilter
          name="sort"
          label="Order"
          items={[
            { value: 'oldest', label: 'Oldest first' },
            { value: 'newest', label: 'Newest first' },
          ]}
        />
        <SearchFilter placeholder="Search pending activities" />
        <SelectFilter name="type" label="Types" items={typeItems} />
        <SelectFilter
          name="section"
          label="Sections"
          items={sections.map((s) => ({ value: String(s.id), label: s.code }))}
        />
      </FilterBar>
      <ActivitiesTable
        rows={activities.map(toActivityRow)}
        empty={<NoResults what="pending activities" />}
      />
      <PaginationBar
        page={filters.page}
        pageSize={PAGE_SIZE}
        total={total}
        searchParams={await searchParams}
      />
    </>
  )
}
