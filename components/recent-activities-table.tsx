'use client'

import { createColumnHelper } from '@tanstack/react-table'
import { CalendarPlus } from 'lucide-react'
import Link from 'next/link'
import { DataTable, type features } from '@/components/data-table'
import { StatusBadge } from '@/components/status-badge'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import type { ActivityStatus } from '@/generated/prisma/enums'

// Display-ready: dates are formatted on the server, in APP_TIMEZONE.
export type RecentActivityRow = {
  id: number
  title: string
  when: string
  section: string
  status: ActivityStatus
}

const columnHelper = createColumnHelper<typeof features, RecentActivityRow>()

const columns = columnHelper.columns([
  columnHelper.accessor('title', {
    header: 'Activity',
    cell: ({ row }) => (
      <Link
        href={`/activities/${row.original.id}`}
        className="font-semibold text-primary hover:underline dark:text-accent-foreground"
      >
        {row.original.title}
      </Link>
    ),
  }),
  columnHelper.accessor('when', { header: 'When' }),
  columnHelper.accessor('section', { header: 'Section' }),
  columnHelper.accessor('status', {
    header: 'Status',
    cell: ({ getValue }) => <StatusBadge status={getValue()} />,
  }),
])

export function RecentActivitiesTable({ rows }: { rows: RecentActivityRow[] }) {
  return (
    <DataTable
      columns={columns}
      data={rows}
      empty={
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CalendarPlus />
            </EmptyMedia>
            <EmptyTitle>No activities yet</EmptyTitle>
            <EmptyDescription>
              Activities you and your colleagues file will show up here.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      }
    />
  )
}
