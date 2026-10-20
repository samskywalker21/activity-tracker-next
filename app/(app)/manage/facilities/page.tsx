import { Plus } from 'lucide-react'
import { FacilitiesTable } from '@/components/facilities/facilities-table'
import { FacilityDialog } from '@/components/facilities/facility-dialog'
import { FilterBar, SearchFilter, SelectFilter } from '@/components/filter-bar'
import { PageHeader } from '@/components/page-header'
import { PaginationBar } from '@/components/pagination-bar'
import { Button } from '@/components/ui/button'
import { db } from '@/lib/db'
import { loadListParams, PAGE_SIZE, statusItems, statusWhere } from '@/lib/search-params'
import { requireRole } from '@/lib/session'

export default async function FacilitiesPage({ searchParams }: PageProps<'/manage/facilities'>) {
  await requireRole(['ADMIN', 'MANAGER'])
  const { q, status, page, skip, take } = await loadListParams(searchParams)

  const where = {
    ...statusWhere(status),
    ...(q && { name: { contains: q, mode: 'insensitive' as const } }),
  }
  const [facilities, total] = await Promise.all([
    db.facility.findMany({ where, orderBy: { name: 'asc' }, skip, take }),
    db.facility.count({ where }),
  ])

  return (
    <>
      <PageHeader
        title="Facilities"
        description="Health facilities an activity can involve."
        actions={
          <FacilityDialog
            trigger={
              <Button>
                <Plus data-icon="inline-start" />
                Add facility
              </Button>
            }
          />
        }
      />
      <FilterBar>
        <SearchFilter placeholder="Search facilities" />
        <SelectFilter name="status" label="Statuses" items={statusItems} />
      </FilterBar>
      <FacilitiesTable
        rows={facilities.map(({ id, name, isActive }) => ({ id, name, isActive }))}
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
