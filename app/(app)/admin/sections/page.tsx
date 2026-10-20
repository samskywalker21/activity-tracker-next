import { Plus } from 'lucide-react'
import { createLoader, parseAsInteger } from 'nuqs/server'
import { FilterBar, SearchFilter, SelectFilter } from '@/components/filter-bar'
import { PageHeader } from '@/components/page-header'
import { PaginationBar } from '@/components/pagination-bar'
import { SectionDialog } from '@/components/sections/section-dialog'
import { SectionsTable } from '@/components/sections/sections-table'
import { Button } from '@/components/ui/button'
import { db } from '@/lib/db'
import { loadListParams, PAGE_SIZE, statusItems, statusWhere } from '@/lib/search-params'
import { requireRole } from '@/lib/session'

const loadDivisionParam = createLoader({ division: parseAsInteger })

export default async function SectionsPage({ searchParams }: PageProps<'/admin/sections'>) {
  await requireRole(['ADMIN'])
  const { q, status, page, skip, take } = await loadListParams(searchParams)
  const { division } = await loadDivisionParam(searchParams)

  const where = {
    ...statusWhere(status),
    ...(division && { divisionId: division }),
    ...(q && {
      OR: [
        { code: { contains: q, mode: 'insensitive' as const } },
        { name: { contains: q, mode: 'insensitive' as const } },
      ],
    }),
  }
  const [sections, total, divisions] = await Promise.all([
    db.section.findMany({
      where,
      orderBy: { code: 'asc' },
      skip,
      take,
      include: { division: { select: { code: true } } },
    }),
    db.section.count({ where }),
    db.division.findMany({
      orderBy: { code: 'asc' },
      select: { id: true, code: true, name: true, isActive: true },
    }),
  ])

  return (
    <>
      <PageHeader
        title="Sections"
        description="Every user and activity belongs to a section."
        actions={
          <SectionDialog
            divisions={divisions}
            trigger={
              <Button>
                <Plus data-icon="inline-start" />
                Add section
              </Button>
            }
          />
        }
      />
      <FilterBar>
        <SearchFilter placeholder="Search sections" />
        <SelectFilter
          name="division"
          label="Divisions"
          items={divisions.map((d) => ({ value: String(d.id), label: d.code }))}
        />
        <SelectFilter name="status" label="Statuses" items={statusItems} />
      </FilterBar>
      <SectionsTable
        divisions={divisions}
        rows={sections.map((section) => ({
          id: section.id,
          code: section.code,
          name: section.name,
          divisionId: section.divisionId,
          division: section.division.code,
          isActive: section.isActive,
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
