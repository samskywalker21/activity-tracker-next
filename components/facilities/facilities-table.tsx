'use client'

import { createColumnHelper } from '@tanstack/react-table'
import { setFacilityActive } from '@/actions/facilities'
import { ActiveBadge } from '@/components/active-badge'
import { DataTable, type features } from '@/components/data-table'
import { FacilityDialog } from '@/components/facilities/facility-dialog'
import { NoResults } from '@/components/no-results'
import { SetActiveButton } from '@/components/set-active-button'
import { Button } from '@/components/ui/button'

export type FacilityRow = { id: number; name: string; isActive: boolean }

const columnHelper = createColumnHelper<typeof features, FacilityRow>()

const columns = columnHelper.columns([
  columnHelper.accessor('name', {
    header: 'Name',
    cell: ({ getValue }) => <span className="font-semibold">{getValue()}</span>,
  }),
  columnHelper.accessor('isActive', {
    header: 'Status',
    cell: ({ getValue }) => <ActiveBadge isActive={getValue()} />,
  }),
  columnHelper.display({
    id: 'actions',
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row: { original: facility } }) => (
      <div className="flex justify-end gap-1">
        <FacilityDialog
          facility={facility}
          trigger={
            <Button variant="ghost" size="sm">
              Edit
            </Button>
          }
        />
        <SetActiveButton
          isActive={facility.isActive}
          name={facility.name}
          onConfirm={() => setFacilityActive(facility.id, !facility.isActive)}
        />
      </div>
    ),
  }),
])

export function FacilitiesTable({ rows }: { rows: FacilityRow[] }) {
  return <DataTable columns={columns} data={rows} empty={<NoResults what="facilities" />} />
}
