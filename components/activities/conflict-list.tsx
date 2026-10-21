import Link from 'next/link'
import { StatusBadge } from '@/components/status-badge'
import { type GroupedConflicts, sharedLabels } from '@/lib/conflicts'
import { formatDays, formatRange } from '@/lib/dates'

/**
 * The grouped conflict check: clashes first, then same-time-only activities, then holidays.
 * `linked` makes the titles links, for pages without unsaved input to lose.
 */
export function ConflictList({ grouped, linked }: { grouped: GroupedConflicts; linked?: boolean }) {
  const title = (row: { id: number; title: string }) =>
    linked ? (
      <Link href={`/activities/${row.id}`} className="underline-offset-4 hover:underline">
        {row.title}
      </Link>
    ) : (
      row.title
    )

  return (
    <div className="grid gap-4 text-sm">
      {grouped.clashes.length > 0 && (
        <section className="grid gap-2">
          <h3 className="font-semibold">Shares people or places</h3>
          <ul className="grid gap-2">
            {grouped.clashes.map((row) => (
              <li key={row.id} className="grid gap-0.5">
                <span className="flex items-center justify-between gap-2 font-medium">
                  {title(row)}
                  <StatusBadge status={row.status} />
                </span>
                <span className="text-muted-foreground">
                  {formatRange(row.start, row.end, row.allDay)} ·{' '}
                  {row.shares.map((kind) => sharedLabels[kind]).join(', ')}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {grouped.sameTime.length > 0 && (
        <section className="grid gap-2">
          <h3 className="font-semibold">At the same time</h3>
          <ul className="grid gap-2">
            {grouped.sameTime.map((row) => (
              <li key={row.id} className="grid gap-0.5">
                <span className="font-medium">{title(row)}</span>
                <span className="text-muted-foreground">
                  {formatRange(row.start, row.end, row.allDay)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {grouped.holidays.length > 0 && (
        <section className="grid gap-2">
          <h3 className="font-semibold">Holidays</h3>
          <ul className="grid gap-2">
            {grouped.holidays.map((holiday) => (
              <li key={holiday.id} className="grid gap-0.5">
                <span className="font-medium">{holiday.name}</span>
                <span className="text-muted-foreground">
                  {formatDays(holiday.start, holiday.end)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
