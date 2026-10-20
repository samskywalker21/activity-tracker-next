'use client'

import { createColumnHelper } from '@tanstack/react-table'
import { useMemo } from 'react'
import { setLguActive } from '@/actions/lgus'
import { ActiveBadge } from '@/components/active-badge'
import { DataTable, type features } from '@/components/data-table'
import { LguDialog, type ProvinceOption } from '@/components/lgus/lgu-dialog'
import { NoResults } from '@/components/no-results'
import { SetActiveButton } from '@/components/set-active-button'
import { Button } from '@/components/ui/button'

export type LguRow = {
  id: string
  muncity: string
  provinceId: number
  province: string
  isActive: boolean
}

const columnHelper = createColumnHelper<typeof features, LguRow>()

export function LgusTable({ rows, provinces }: { rows: LguRow[]; provinces: ProvinceOption[] }) {
  // Built here because the edit dialog needs the province list.
  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.accessor('muncity', {
          header: 'Municipality / city',
          cell: ({ getValue }) => <span className="font-semibold">{getValue()}</span>,
        }),
        columnHelper.accessor('province', { header: 'Province' }),
        columnHelper.accessor('id', { header: 'PSGC code' }),
        columnHelper.accessor('isActive', {
          header: 'Status',
          cell: ({ getValue }) => <ActiveBadge isActive={getValue()} />,
        }),
        columnHelper.display({
          id: 'actions',
          header: () => <span className="sr-only">Actions</span>,
          cell: ({ row: { original: lgu } }) => (
            <div className="flex justify-end gap-1">
              <LguDialog
                lgu={lgu}
                provinces={provinces}
                trigger={
                  <Button variant="ghost" size="sm">
                    Edit
                  </Button>
                }
              />
              <SetActiveButton
                isActive={lgu.isActive}
                name={lgu.muncity}
                onConfirm={() => setLguActive(lgu.id, !lgu.isActive)}
              />
            </div>
          ),
        }),
      ]),
    [provinces]
  )

  return <DataTable columns={columns} data={rows} empty={<NoResults what="LGUs" />} />
}
