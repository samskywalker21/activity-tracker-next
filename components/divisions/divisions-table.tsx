'use client'

import { createColumnHelper } from '@tanstack/react-table'
import { setDivisionActive } from '@/actions/divisions'
import { ActiveBadge } from '@/components/active-badge'
import { DataTable, type features } from '@/components/data-table'
import { DivisionDialog } from '@/components/divisions/division-dialog'
import { NoResults } from '@/components/no-results'
import { SetActiveButton } from '@/components/set-active-button'
import { Button } from '@/components/ui/button'

export type DivisionRow = {
  id: number
  code: string
  name: string
  sections: number
  isActive: boolean
}

const columnHelper = createColumnHelper<typeof features, DivisionRow>()

const columns = columnHelper.columns([
  columnHelper.accessor('code', {
    header: 'Code',
    cell: ({ getValue }) => <span className="font-semibold">{getValue()}</span>,
  }),
  columnHelper.accessor('name', { header: 'Name' }),
  columnHelper.accessor('sections', { header: 'Sections' }),
  columnHelper.accessor('isActive', {
    header: 'Status',
    cell: ({ getValue }) => <ActiveBadge isActive={getValue()} />,
  }),
  columnHelper.display({
    id: 'actions',
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row: { original: division } }) => (
      <div className="flex justify-end gap-1">
        <DivisionDialog
          division={division}
          trigger={
            <Button variant="ghost" size="sm">
              Edit
            </Button>
          }
        />
        <SetActiveButton
          isActive={division.isActive}
          name={division.code}
          description={
            division.isActive
              ? 'It will no longer be offered when adding or moving a section. Its sections stay as they are.'
              : undefined
          }
          onConfirm={() => setDivisionActive(division.id, !division.isActive)}
        />
      </div>
    ),
  }),
])

export function DivisionsTable({ rows }: { rows: DivisionRow[] }) {
  return <DataTable columns={columns} data={rows} empty={<NoResults what="divisions" />} />
}
