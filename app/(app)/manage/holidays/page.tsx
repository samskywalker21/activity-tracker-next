import { Plus } from 'lucide-react'
import { FilterBar, SearchFilter } from '@/components/filter-bar'
import { HolidayDialog } from '@/components/holidays/holiday-dialog'
import { HolidaysTable } from '@/components/holidays/holidays-table'
import { PageHeader } from '@/components/page-header'
import { PaginationBar } from '@/components/pagination-bar'
import { Button } from '@/components/ui/button'
import { formatDay, formatDays } from '@/lib/dates'
import { db } from '@/lib/db'
import { loadListParams, PAGE_SIZE } from '@/lib/search-params'
import { requireRole } from '@/lib/session'

export default async function HolidaysPage({ searchParams }: PageProps<'/manage/holidays'>) {
  await requireRole(['ADMIN', 'MANAGER'])
  const { q, page, skip, take } = await loadListParams(searchParams)

  const where = q ? { name: { contains: q, mode: 'insensitive' as const } } : {}
  const [holidays, total] = await Promise.all([
    db.holiday.findMany({ where, orderBy: { start: 'desc' }, skip, take }),
    db.holiday.count({ where }),
  ])

  return (
    <>
      <PageHeader
        title="Holidays"
        description="Shown on the calendar and flagged when an activity falls on one."
        actions={
          <HolidayDialog
            trigger={
              <Button>
                <Plus data-icon="inline-start" />
                Add holiday
              </Button>
            }
          />
        }
      />
      <FilterBar>
        <SearchFilter placeholder="Search holidays" />
      </FilterBar>
      <HolidaysTable
        rows={holidays.map((holiday) => ({
          id: holiday.id,
          name: holiday.name,
          start: formatDay(holiday.start),
          end: formatDay(holiday.end),
          dates: formatDays(holiday.start, holiday.end),
        }))}
      />
      <PaginationBar
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        searchParams={await searchParams}
      />
    </>
  )
}
