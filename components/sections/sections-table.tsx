'use client'

import { createColumnHelper } from '@tanstack/react-table'
import { useMemo } from 'react'
import { setSectionActive } from '@/actions/sections'
import { ActiveBadge } from '@/components/active-badge'
import { DataTable, type features } from '@/components/data-table'
import { NoResults } from '@/components/no-results'
import { type DivisionOption, SectionDialog } from '@/components/sections/section-dialog'
import { SetActiveButton } from '@/components/set-active-button'
import { Button } from '@/components/ui/button'

export type SectionRow = {
  id: number
  code: string
  name: string
  divisionId: number
  division: string
  isActive: boolean
}

const columnHelper = createColumnHelper<typeof features, SectionRow>()

export function SectionsTable({
  rows,
  divisions,
}: {
  rows: SectionRow[]
  divisions: DivisionOption[]
}) {
  // Built here because the edit dialog needs the division list.
  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.accessor('code', {
          header: 'Code',
          cell: ({ getValue }) => <span className="font-semibold">{getValue()}</span>,
        }),
        columnHelper.accessor('name', { header: 'Name' }),
        columnHelper.accessor('division', { header: 'Division' }),
        columnHelper.accessor('isActive', {
          header: 'Status',
          cell: ({ getValue }) => <ActiveBadge isActive={getValue()} />,
        }),
        columnHelper.display({
          id: 'actions',
          header: () => <span className="sr-only">Actions</span>,
          cell: ({ row: { original: section } }) => (
            <div className="flex justify-end gap-1">
              <SectionDialog
                section={section}
                divisions={divisions}
                trigger={
                  <Button variant="ghost" size="sm">
                    Edit
                  </Button>
                }
              />
              <SetActiveButton
                isActive={section.isActive}
                name={section.code}
                description={
                  section.isActive
                    ? 'It will no longer be offered at sign-up or for new activities. People and activities already in it keep it.'
                    : undefined
                }
                onConfirm={() => setSectionActive(section.id, !section.isActive)}
              />
            </div>
          ),
        }),
      ]),
    [divisions]
  )

  return <DataTable columns={columns} data={rows} empty={<NoResults what="sections" />} />
}
