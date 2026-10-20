'use client'

import { createColumnHelper } from '@tanstack/react-table'
import { ArrowRight } from 'lucide-react'
import { DataTable, type features } from '@/components/data-table'
import { NoResults } from '@/components/no-results'

// Display-ready: values are already formatted as text on the server.
export type AuditRow = {
  id: number
  when: string
  actor: string | null
  action: string
  entity: string | null
  changes: { field: string; before: string; after: string }[]
  details: { key: string; value: string }[]
}

const columnHelper = createColumnHelper<typeof features, AuditRow>()

const columns = columnHelper.columns([
  columnHelper.accessor('when', {
    header: 'When',
    cell: ({ getValue }) => <span className="whitespace-nowrap">{getValue()}</span>,
  }),
  columnHelper.accessor('actor', {
    header: 'Actor',
    cell: ({ getValue }) => getValue() ?? <span className="text-muted-foreground">Guest</span>,
  }),
  columnHelper.accessor('action', {
    header: 'Action',
    cell: ({ getValue }) => <code className="font-mono text-xs">{getValue()}</code>,
  }),
  columnHelper.accessor('entity', {
    header: 'Entity',
    cell: ({ getValue }) => getValue() ?? <span className="text-muted-foreground">—</span>,
  }),
  columnHelper.display({
    id: 'changes',
    header: 'Changes',
    cell: ({ row: { original: entry } }) => (
      <dl className="grid max-w-xl grid-cols-[auto_1fr] gap-x-3 gap-y-1 whitespace-normal text-xs">
        {entry.changes.map(({ field, before, after }) => (
          <div key={field} className="contents">
            <dt className="font-medium">{field}</dt>
            <dd className="flex flex-wrap items-center gap-1 break-all">
              <span className="text-muted-foreground line-through">{before}</span>
              <ArrowRight aria-label="to" className="size-3 shrink-0" />
              <span>{after}</span>
            </dd>
          </div>
        ))}
        {entry.details.map(({ key, value }) => (
          <div key={key} className="contents">
            <dt className="font-medium">{key}</dt>
            <dd className="break-all text-muted-foreground">{value}</dd>
          </div>
        ))}
      </dl>
    ),
  }),
])

export function AuditTable({ rows }: { rows: AuditRow[] }) {
  return <DataTable columns={columns} data={rows} empty={<NoResults what="audit entries" />} />
}
