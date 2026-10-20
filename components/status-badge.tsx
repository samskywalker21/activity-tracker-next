import { cn } from 'cn'
import type { ActivityStatus } from '@/generated/prisma/enums'
import { statusDotClasses, statusLabels } from '@/lib/status'

export function StatusBadge({ status }: { status: ActivityStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border bg-card px-2 py-0.5 font-medium text-xs">
      <span aria-hidden className={cn('size-2 rounded-full', statusDotClasses[status])} />
      {statusLabels[status]}
    </span>
  )
}
