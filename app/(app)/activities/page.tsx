import { Plus } from 'lucide-react'
import Link from 'next/link'
import { ActivitiesTable } from '@/components/activities/activities-table'
import { ExportButton } from '@/components/activities/export-button'
import { DateRangeFilter, FilterBar, SearchFilter, SelectFilter } from '@/components/filter-bar'
import { NoResults } from '@/components/no-results'
import { PageHeader } from '@/components/page-header'
import { PaginationBar } from '@/components/pagination-bar'
import { Button } from '@/components/ui/button'
import { ActivityStatus, ActivityType } from '@/generated/prisma/enums'
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
import { statusLabels, typeLabels } from '@/lib/status'

const statusItems = Object.values(ActivityStatus).map((s) => ({ value: s, label: statusLabels[s] }))
const typeItems = Object.values(ActivityType).map((t) => ({ value: t, label: typeLabels[t] }))
const virtualItems = [
  { value: 'yes', label: 'Online' },
  { value: 'no', label: 'In person' },
]

export default async function ActivitiesPage({ searchParams }: PageProps<'/activities'>) {
  await requireUser()
  const filters = await loadActivityFilters(searchParams)

  const where = activityWhere(filters)
  const [activities, total, sections, divisions, creators] = await Promise.all([
    db.activity.findMany({
      where,
      include: activityRowInclude,
      orderBy: activityOrder,
      skip: filters.skip,
      take: filters.take,
    }),
    db.activity.count({ where }),
    db.section.findMany({ orderBy: { code: 'asc' } }),
    db.division.findMany({ orderBy: { code: 'asc' } }),
    db.user.findMany({
      where: { createdActivities: { some: {} } },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  return (
    <>
      <PageHeader
        title="All activities"
        description="Everything filed across the office."
        actions={
          <>
            <ExportButton />
            <Button nativeButton={false} render={<Link href="/activities/new" />}>
              <Plus data-icon="inline-start" />
              New activity
            </Button>
          </>
        }
      />
      <FilterBar>
        <SearchFilter placeholder="Search activities" />
        <SelectFilter name="status" label="Statuses" items={statusItems} />
        <SelectFilter name="type" label="Types" items={typeItems} />
        <SelectFilter name="virtual" label="Formats" items={virtualItems} />
        <SelectFilter
          name="division"
          label="Divisions"
          items={divisions.map((d) => ({ value: String(d.id), label: d.code }))}
        />
        <SelectFilter
          name="section"
          label="Sections"
          items={sections.map((s) => ({ value: String(s.id), label: s.code }))}
        />
        <SelectFilter
          name="createdBy"
          label="Filers"
          items={creators.map((u) => ({ value: u.id, label: u.name }))}
        />
        <DateRangeFilter label="Start" />
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
