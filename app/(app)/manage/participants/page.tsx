import { Plus } from 'lucide-react'
import { FilterBar, SearchFilter, SelectFilter } from '@/components/filter-bar'
import { PageHeader } from '@/components/page-header'
import { PaginationBar } from '@/components/pagination-bar'
import { ParticipantDialog } from '@/components/participants/participant-dialog'
import { ParticipantsTable } from '@/components/participants/participants-table'
import { Button } from '@/components/ui/button'
import { db } from '@/lib/db'
import { loadListParams, PAGE_SIZE, statusItems, statusWhere } from '@/lib/search-params'
import { requireRole } from '@/lib/session'

export default async function ParticipantsPage({
  searchParams,
}: PageProps<'/manage/participants'>) {
  await requireRole(['ADMIN', 'MANAGER'])
  const { q, status, page, skip, take } = await loadListParams(searchParams)

  const where = {
    ...statusWhere(status),
    ...(q && { name: { contains: q, mode: 'insensitive' as const } }),
  }
  const [participants, total] = await Promise.all([
    db.participant.findMany({ where, orderBy: { name: 'asc' }, skip, take }),
    db.participant.count({ where }),
  ])

  return (
    <>
      <PageHeader
        title="Participants"
        description="The groups an activity can involve."
        actions={
          <ParticipantDialog
            trigger={
              <Button>
                <Plus data-icon="inline-start" />
                Add participant
              </Button>
            }
          />
        }
      />
      <FilterBar>
        <SearchFilter placeholder="Search participants" />
        <SelectFilter name="status" label="Statuses" items={statusItems} />
      </FilterBar>
      <ParticipantsTable
        rows={participants.map(({ id, name, isInternal, isActive }) => ({
          id,
          name,
          isInternal,
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
