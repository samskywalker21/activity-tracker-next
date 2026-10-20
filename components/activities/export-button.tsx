'use client'

import { Download } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { exportActivities } from '@/actions/activities'
import { Button } from '@/components/ui/button'
import { formatDay } from '@/lib/dates'

/** Downloads the list's current search and filters, every page, as CSV. */
export function ExportButton() {
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()

  function onClick() {
    startTransition(async () => {
      const result = await exportActivities(searchParams.toString())
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      // The BOM makes Excel read the file as UTF-8 (LGU names with ñ, for one).
      const blob = new Blob(['﻿', result.data], { type: 'text/csv;charset=utf-8' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `activities-${formatDay(new Date())}.csv`
      link.click()
      URL.revokeObjectURL(link.href)
    })
  }

  return (
    <Button variant="outline" onClick={onClick} disabled={pending}>
      <Download data-icon="inline-start" />
      {pending ? 'Exporting…' : 'Export CSV'}
    </Button>
  )
}
