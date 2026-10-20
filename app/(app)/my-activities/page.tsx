import { Plus } from 'lucide-react'
import Link from 'next/link'
import { ActivitiesTable } from '@/components/activities/activities-table'
import { FilterBar, SearchFilter, TabsFilter } from '@/components/filter-bar'
import { NoResults } from '@/components/no-results'
import { PageHeader } from '@/components/page-header'
import { PaginationBar } from '@/components/pagination-bar'
import { Button } from '@/components/ui/button'
import type { ActivityStatus } from '@/generated/prisma/enums'
import {
  activityOrder,
  activityRowInclude,
  activityWhere,
  loadActivityFilters,
  toActivityRow,
} from '@/lib/activity-list'
import { db } from '@/lib/db'
import { PAGE_SIZE } from '@/lib/search-params'
import { requireUser } from '@/lib/session'
import { statusLabels } from '@/lib/status'

const tabStatuses: ActivityStatus[] = ['PENDING', 'APPROVED', 'RETURNED']

export default async function MyActivitiesPage({ searchParams }: PageProps<'/my-activities'>) {
  const user = await requireUser()
  const filters = await loadActivityFilters(searchParams)
  // Only the three tabs; anything else in `?status=` falls back to the first.
  const status = tabStatuses.find((s) => s === filters.status) ?? tabStatuses[0]

  const mine = { createdById: user.id }
  const where = activityWhere({ ...filters, status, createdBy: user.id })
  const [activities, total, counts] = await Promise.all([
    db.activity.findMany({
      where,
      include: activityRowInclude,
      orderBy: activityOrder,
      skip: filters.skip,
      take: filters.take,
    }),
    db.activity.count({ where }),
    db.activity.groupBy({
      by: ['status'],
      where: { ...mine, status: { in: tabStatuses } },
      _count: true,
    }),
  ])

  return (
    <>
      <PageHeader
        title="My activities"
        description="The activities you filed, by where they stand."
        actions={
          <Button nativeButton={false} render={<Link href="/activities/new" />}>
            <Plus data-icon="inline-start" />
            New activity
          </Button>
        }
      />
      <TabsFilter
        name="status"
        label="Status"
        items={tabStatuses.map((s) => ({
          value: s,
          label: `${statusLabels[s]} (${counts.find((c) => c.status === s)?._count ?? 0})`,
        }))}
      />
      <FilterBar>
        <SearchFilter placeholder="Search my activities" />
      </FilterBar>
      <ActivitiesTable
        rows={activities.map(toActivityRow)}
        empty={<NoResults what="activities" />}
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
