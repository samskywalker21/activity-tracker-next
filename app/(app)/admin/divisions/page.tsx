import { Plus } from 'lucide-react'
import { DivisionDialog } from '@/components/divisions/division-dialog'
import { DivisionsTable } from '@/components/divisions/divisions-table'
import { FilterBar, SearchFilter, SelectFilter } from '@/components/filter-bar'
import { PageHeader } from '@/components/page-header'
import { PaginationBar } from '@/components/pagination-bar'
import { Button } from '@/components/ui/button'
import { db } from '@/lib/db'
import { loadListParams, PAGE_SIZE, statusItems, statusWhere } from '@/lib/search-params'
import { requireRole } from '@/lib/session'

export default async function DivisionsPage({ searchParams }: PageProps<'/admin/divisions'>) {
  await requireRole(['ADMIN'])
  const { q, status, page, skip, take } = await loadListParams(searchParams)

  const where = {
    ...statusWhere(status),
    ...(q && {
      OR: [
        { code: { contains: q, mode: 'insensitive' as const } },
        { name: { contains: q, mode: 'insensitive' as const } },
      ],
    }),
  }
  const [divisions, total] = await Promise.all([
    db.division.findMany({
      where,
      orderBy: { code: 'asc' },
      skip,
      take,
      include: { _count: { select: { sections: true } } },
    }),
    db.division.count({ where }),
  ])

  return (
    <>
      <PageHeader
        title="Divisions"
        description="The office's divisions; every section belongs to one."
        actions={
          <DivisionDialog
            trigger={
              <Button>
                <Plus data-icon="inline-start" />
                Add division
              </Button>
            }
          />
        }
      />
      <FilterBar>
        <SearchFilter placeholder="Search divisions" />
        <SelectFilter name="status" label="Statuses" items={statusItems} />
      </FilterBar>
      <DivisionsTable
        rows={divisions.map((division) => ({
          id: division.id,
          code: division.code,
          name: division.name,
          sections: division._count.sections,
          isActive: division.isActive,
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
