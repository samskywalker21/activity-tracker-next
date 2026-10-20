import { cn } from 'cn'

export function ActiveBadge({ isActive }: { isActive: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border bg-card px-2 py-0.5 font-medium text-xs">
      <span
        aria-hidden
        className={cn('size-2 rounded-full', isActive ? 'bg-primary' : 'bg-status-cancelled')}
      />
      {isActive ? 'Active' : 'Inactive'}
    </span>
  )
}
