'use client'

import { createColumnHelper } from '@tanstack/react-table'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { DataTable, type features } from '@/components/data-table'
import { StatusBadge } from '@/components/status-badge'
import type { ActivityStatus } from '@/generated/prisma/enums'

// Display-ready: built by `toActivityRow` on the server, dates in APP_TIMEZONE.
export type ActivityRow = {
  id: number
  title: string
  venue: string
  when: string
  section: string
  createdBy: string
  status: ActivityStatus
}

const columnHelper = createColumnHelper<typeof features, ActivityRow>()

const columns = columnHelper.columns([
  columnHelper.accessor('title', {
    header: 'Activity',
    cell: ({ row }) => (
      <div className="grid gap-0.5">
        <Link
          href={`/activities/${row.original.id}`}
          className="font-semibold text-primary hover:underline dark:text-accent-foreground"
        >
          {row.original.title}
        </Link>
        <span className="text-muted-foreground text-xs">{row.original.venue}</span>
      </div>
    ),
  }),
  columnHelper.accessor('when', { header: 'When' }),
  columnHelper.accessor('section', { header: 'Section' }),
  columnHelper.accessor('createdBy', { header: 'Filed by' }),
  columnHelper.accessor('status', {
    header: 'Status',
    cell: ({ getValue }) => <StatusBadge status={getValue()} />,
  }),
])

export function ActivitiesTable({ rows, empty }: { rows: ActivityRow[]; empty: ReactNode }) {
  return <DataTable columns={columns} data={rows} empty={empty} />
}
