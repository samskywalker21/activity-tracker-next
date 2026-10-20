'use client'

import { createColumnHelper } from '@tanstack/react-table'
import { DataTable, type features } from '@/components/data-table'
import { DeleteHolidayButton } from '@/components/holidays/delete-holiday-button'
import { HolidayDialog } from '@/components/holidays/holiday-dialog'
import { NoResults } from '@/components/no-results'
import { Button } from '@/components/ui/button'

/** `start`/`end` are `yyyy-MM-dd` for the form; `dates` is the display text. */
export type HolidayRow = { id: number; name: string; start: string; end: string; dates: string }

const columnHelper = createColumnHelper<typeof features, HolidayRow>()

const columns = columnHelper.columns([
  columnHelper.accessor('name', {
    header: 'Name',
    cell: ({ getValue }) => <span className="font-semibold">{getValue()}</span>,
  }),
  columnHelper.accessor('dates', { header: 'Dates' }),
  columnHelper.display({
    id: 'actions',
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row: { original: holiday } }) => (
      <div className="flex justify-end gap-1">
        <HolidayDialog
          holiday={holiday}
          trigger={
            <Button variant="ghost" size="sm">
              Edit
            </Button>
          }
        />
        <DeleteHolidayButton id={holiday.id} name={holiday.name} />
      </div>
    ),
  }),
])

export function HolidaysTable({ rows }: { rows: HolidayRow[] }) {
  return <DataTable columns={columns} data={rows} empty={<NoResults what="holidays" />} />
}
