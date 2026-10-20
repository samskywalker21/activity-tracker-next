'use client'

import { createColumnHelper } from '@tanstack/react-table'
import { setParticipantActive } from '@/actions/participants'
import { ActiveBadge } from '@/components/active-badge'
import { DataTable, type features } from '@/components/data-table'
import { NoResults } from '@/components/no-results'
import { ParticipantDialog } from '@/components/participants/participant-dialog'
import { SetActiveButton } from '@/components/set-active-button'
import { Button } from '@/components/ui/button'

export type ParticipantRow = { id: number; name: string; isInternal: boolean; isActive: boolean }

const columnHelper = createColumnHelper<typeof features, ParticipantRow>()

const columns = columnHelper.columns([
  columnHelper.accessor('name', {
    header: 'Name',
    cell: ({ getValue }) => <span className="font-semibold">{getValue()}</span>,
  }),
  columnHelper.accessor('isInternal', {
    header: 'Type',
    cell: ({ getValue }) => (getValue() ? 'Internal (DOH)' : 'External'),
  }),
  columnHelper.accessor('isActive', {
    header: 'Status',
    cell: ({ getValue }) => <ActiveBadge isActive={getValue()} />,
  }),
  columnHelper.display({
    id: 'actions',
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row: { original: participant } }) => (
      <div className="flex justify-end gap-1">
        <ParticipantDialog
          participant={participant}
          trigger={
            <Button variant="ghost" size="sm">
              Edit
            </Button>
          }
        />
        <SetActiveButton
          isActive={participant.isActive}
          name={participant.name}
          onConfirm={() => setParticipantActive(participant.id, !participant.isActive)}
        />
      </div>
    ),
  }),
])

export function ParticipantsTable({ rows }: { rows: ParticipantRow[] }) {
  return <DataTable columns={columns} data={rows} empty={<NoResults what="participants" />} />
}
