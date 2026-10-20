import { Plus } from 'lucide-react'
import { createLoader, parseAsInteger } from 'nuqs/server'
import { FilterBar, SearchFilter, SelectFilter } from '@/components/filter-bar'
import { LguDialog } from '@/components/lgus/lgu-dialog'
import { LgusTable } from '@/components/lgus/lgus-table'
import { PageHeader } from '@/components/page-header'
import { PaginationBar } from '@/components/pagination-bar'
import { Button } from '@/components/ui/button'
import { db } from '@/lib/db'
import { loadListParams, PAGE_SIZE, statusItems, statusWhere } from '@/lib/search-params'
import { requireRole } from '@/lib/session'

const loadProvinceParam = createLoader({ province: parseAsInteger })

export default async function LgusPage({ searchParams }: PageProps<'/admin/lgus'>) {
  await requireRole(['ADMIN'])
  const { q, status, page, skip, take } = await loadListParams(searchParams)
  const { province } = await loadProvinceParam(searchParams)

  const where = {
    ...statusWhere(status),
    ...(province && { provinceId: province }),
    ...(q && {
      OR: [{ muncity: { contains: q, mode: 'insensitive' as const } }, { id: { startsWith: q } }],
    }),
  }
  const [lgus, total, provinceRows] = await Promise.all([
    db.lgu.findMany({ where, orderBy: [{ province: 'asc' }, { muncity: 'asc' }], skip, take }),
    db.lgu.count({ where }),
    db.lgu.findMany({
      distinct: ['provinceId'],
      orderBy: { provinceId: 'asc' },
      select: { provinceId: true, province: true },
    }),
  ])
  const provinces = provinceRows
    .map((row) => ({ id: row.provinceId, name: row.province }))
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <>
      <PageHeader
        title="LGUs"
        description="Region 10 municipalities and cities, by PSGC code."
        actions={
          <LguDialog
            provinces={provinces}
            trigger={
              <Button>
                <Plus data-icon="inline-start" />
                Add LGU
              </Button>
            }
          />
        }
      />
      <FilterBar>
        <SearchFilter placeholder="Search name or PSGC code" />
        <SelectFilter
          name="province"
          label="Provinces"
          items={provinces.map((p) => ({ value: String(p.id), label: p.name }))}
        />
        <SelectFilter name="status" label="Statuses" items={statusItems} />
      </FilterBar>
      <LgusTable
        provinces={provinces}
        rows={lgus.map(({ id, muncity, provinceId, province, isActive }) => ({
          id,
          muncity,
          provinceId,
          province,
          isActive,
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
