import { cn } from 'cn'
import { formatDistanceToNow } from 'date-fns'
import {
  Building2,
  CalendarDays,
  type LucideIcon,
  MapPin,
  Pencil,
  TriangleAlert,
  UserRound,
  Users,
} from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import { CancelDialog } from '@/components/activities/cancel-dialog'
import { CommentItem, NewComment } from '@/components/activities/comments'
import { ConflictList } from '@/components/activities/conflict-list'
import { ReviewPanel } from '@/components/activities/review-panel'
import { StatusBadge } from '@/components/status-badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { groupConflicts } from '@/lib/conflicts'
import { countDays, formatDateTime, formatDays, formatTimes, fromNow } from '@/lib/dates'
import { db } from '@/lib/db'
import { findConflicts } from '@/lib/find-conflicts'
import { canCancel, canEdit, canReview } from '@/lib/rules'
import { requireUser } from '@/lib/session'
import { statusDotClasses, statusLabels, typeLabels } from '@/lib/status'

const decidedLabels = {
  RETURNED: 'Returned for changes',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
} as const

export default async function ActivityPage({ params }: PageProps<'/activities/[id]'>) {
  const user = await requireUser()
  const id = Number((await params).id)
  if (!Number.isInteger(id)) notFound()

  const activity = await db.activity.findUnique({
    where: { id },
    include: {
      section: true,
      createdBy: { select: { name: true } },
      participants: { orderBy: { name: 'asc' } },
      lgus: { orderBy: [{ province: 'asc' }, { muncity: 'asc' }] },
      facilities: { orderBy: { name: 'asc' } },
      events: { include: { actor: { select: { name: true } } }, orderBy: { id: 'asc' } },
      comments: { include: { author: { select: { name: true } } }, orderBy: { id: 'asc' } },
    },
  })
  if (!activity) notFound()

  const reviewing = canReview(user, activity)
  // The event that set the current status carries the reason the creator needs to read.
  const decision =
    activity.status in decidedLabels
      ? activity.events.findLast((event) => event.toStatus === activity.status)
      : undefined

  // Only what shares people or places, and holidays: same-time-only overlaps are noise here.
  const conflicts =
    activity.status === 'REJECTED' || activity.status === 'CANCELLED'
      ? undefined
      : groupConflicts(
          await findConflicts({
            id,
            start: activity.start,
            end: activity.end,
            participantIds: activity.participants.map((p) => p.id),
            lguIds: activity.lgus.map((l) => l.id),
            facilityIds: activity.facilities.map((f) => f.id),
          })
        )
  const conflictCount = conflicts ? conflicts.clashes.length + conflicts.holidays.length : 0

  // Where it stands in the review queue, which lists the oldest first.
  const queue = reviewing
    ? await Promise.all([
        db.activity.count({
          where: {
            status: 'PENDING',
            OR: [
              { createdAt: { lt: activity.createdAt } },
              { createdAt: activity.createdAt, id: { lt: id } },
            ],
          },
        }),
        db.activity.count({ where: { status: 'PENDING' } }),
      ])
    : undefined
  const submitted = activity.events.findLast((event) => event.toStatus === 'PENDING')

  const timeline = [
    ...activity.events.map((event) => ({ kind: 'event' as const, at: event.createdAt, event })),
    ...activity.comments.map((comment) => ({
      kind: 'comment' as const,
      at: comment.createdAt,
      comment,
    })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime())

  const days = countDays(activity.start, activity.end)
  const internal = activity.participants.filter((p) => p.isInternal).map((p) => p.name)
  const external = activity.participants.filter((p) => !p.isInternal).map((p) => p.name)
  const provinces = Map.groupBy(activity.lgus, (lgu) => lgu.province)

  return (
    <>
      <section className="grid gap-5 rounded-xl bg-card p-4 ring-1 ring-foreground/10 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="grid min-w-0 gap-2.5">
            <h1 className="font-bold text-2xl tracking-tight md:text-3xl">{activity.title}</h1>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={activity.status} />
              <Pill>{typeLabels[activity.type]}</Pill>
              <Pill>
                {activity.section.code} · {activity.section.name}
              </Pill>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {canEdit(user, activity) && (
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href={`/activities/${id}/edit`} />}
              >
                <Pencil /> Edit
              </Button>
            )}
            {canCancel(user, activity) && <CancelDialog id={id} />}
          </div>
        </div>

        <div className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-3">
          <Fact
            icon={CalendarDays}
            label="When"
            value={formatDays(activity.start, activity.end)}
            detail={[
              days > 1 && `${days} days`,
              activity.allDay ? 'All day' : formatTimes(activity.start, activity.end),
              fromNow(activity.start, activity.end),
            ]
              .filter(Boolean)
              .join(' · ')}
          />
          <Fact
            icon={MapPin}
            label="Where"
            value={activity.venue}
            detail={activity.virtual ? 'Online' : 'On site'}
          />
          <Fact
            icon={UserRound}
            label="Owner"
            value={activity.owner}
            detail={`Filed ${formatDays(activity.createdAt, activity.createdAt)} by ${activity.createdBy.name}`}
          />
        </div>
      </section>

      {decision && (
        <Alert variant={activity.status === 'RETURNED' ? 'default' : 'destructive'}>
          <AlertTitle>
            {decidedLabels[activity.status as keyof typeof decidedLabels]} by {decision.actor.name}
          </AlertTitle>
          {decision.note && (
            <AlertDescription className="whitespace-pre-wrap">{decision.note}</AlertDescription>
          )}
        </Alert>
      )}

      {conflicts && conflictCount > 0 && (
        <Alert>
          <TriangleAlert />
          <AlertTitle>Possible conflicts ({conflictCount})</AlertTitle>
          <AlertDescription>
            <ConflictList grouped={{ ...conflicts, sameTime: [] }} linked />
          </AlertDescription>
        </Alert>
      )}

      {/* On a phone the review panel comes first, then the details, then the timeline. */}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:grid-rows-[auto_1fr]">
        <div className="grid gap-6 lg:col-start-1 lg:row-span-2 lg:row-start-1">
          <section className="grid gap-3">
            <h2 className="font-bold text-lg">Details</h2>
            <Card>
              <CardContent>
                <dl className="grid gap-4 sm:grid-cols-2">
                  <Detail label="PR number">{activity.prNo}</Detail>
                  <Detail label="Last updated">{formatDateTime(activity.updatedAt)}</Detail>
                  <Detail label="Remarks" className="sm:col-span-2">
                    {activity.remarks && (
                      <span className="whitespace-pre-wrap font-normal">{activity.remarks}</span>
                    )}
                  </Detail>
                </dl>
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-3">
            <h2 className="font-bold text-lg">Who and where</h2>
            <Card className="gap-0 divide-y py-0">
              <WhoRow
                icon={Users}
                label="Participants"
                summary={summary(activity.participants.length, activity.otherParticipants)}
                groups={[
                  { label: 'DOH', items: internal },
                  { label: 'Partners', items: external },
                  ...typedIn(activity.otherParticipants),
                ]}
              />
              <WhoRow
                icon={MapPin}
                label="LGUs"
                summary={summary(
                  activity.lgus.length,
                  activity.otherLgu,
                  provinces.size === 1
                    ? `in ${[...provinces.keys()][0]}`
                    : `in ${provinces.size} provinces`
                )}
                groups={[
                  ...[...provinces].map(([province, lgus]) => ({
                    label: province,
                    items: lgus.map((lgu) => lgu.muncity),
                  })),
                  ...typedIn(activity.otherLgu),
                ]}
              />
              <WhoRow
                icon={Building2}
                label="Facilities"
                summary={summary(activity.facilities.length, activity.otherFacilities)}
                groups={[
                  { label: 'Listed', items: activity.facilities.map((f) => f.name) },
                  ...typedIn(activity.otherFacilities),
                ]}
              />
            </Card>
          </section>
        </div>

        {queue && (
          <ReviewPanel
            className="-order-1 lg:order-none lg:col-start-2 lg:row-start-1"
            id={id}
            description={[
              submitted &&
                `Submitted ${formatDistanceToNow(submitted.createdAt, { addSuffix: true })}`,
              `${queue[0] + 1} of ${queue[1]} in the queue`,
            ]
              .filter(Boolean)
              .join(' · ')}
          />
        )}

        <section
          className={cn('grid gap-3 lg:col-start-2', queue ? 'lg:row-start-2' : 'lg:row-start-1')}
        >
          <h2 className="font-bold text-lg">Timeline</h2>
          <Card>
            <CardContent className="grid gap-5">
              <ol className="ml-1.5 grid gap-5 border-l-2">
                {timeline.map((entry) =>
                  entry.kind === 'event' ? (
                    <li key={`event-${entry.event.id}`} className="relative pl-5">
                      <span
                        aria-hidden
                        className={cn(
                          '-left-[7px] absolute top-1 size-3 rounded-full ring-4 ring-card',
                          statusDotClasses[entry.event.toStatus]
                        )}
                      />
                      <p>
                        <span className="font-semibold">{entry.event.actor.name}</span>{' '}
                        {entry.event.fromStatus ? (
                          <>
                            changed it from {statusLabels[entry.event.fromStatus]} to{' '}
                            <span className="font-semibold">
                              {statusLabels[entry.event.toStatus]}
                            </span>
                          </>
                        ) : (
                          'submitted it'
                        )}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {formatDateTime(entry.event.createdAt)}
                      </p>
                      {entry.event.note && (
                        <p className="mt-1.5 whitespace-pre-wrap">{entry.event.note}</p>
                      )}
                    </li>
                  ) : (
                    <li key={`comment-${entry.comment.id}`} className="relative pl-5">
                      <span
                        aria-hidden
                        className="-left-[6px] absolute top-1.5 size-2.5 rounded-full bg-muted-foreground ring-4 ring-card"
                      />
                      <CommentItem
                        comment={{
                          id: entry.comment.id,
                          body: entry.comment.body,
                          author: entry.comment.author.name,
                          mine: entry.comment.authorId === user.id,
                          postedAt: formatDateTime(entry.comment.createdAt),
                          edited:
                            entry.comment.updatedAt.getTime() - entry.comment.createdAt.getTime() >
                            1000,
                        }}
                      />
                    </li>
                  )
                )}
              </ol>
              <NewComment activityId={id} />
            </CardContent>
          </Card>
        </section>
      </div>
    </>
  )
}

function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-accent px-2.5 py-0.5 font-semibold text-accent-foreground text-xs">
      {children}
    </span>
  )
}

function Fact({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: LucideIcon
  label: string
  value: string
  detail: string
}) {
  return (
    <div className="flex gap-3 bg-muted p-4">
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="grid min-w-0 content-start gap-0.5">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="font-semibold">{value}</p>
        <p className="text-muted-foreground text-xs">{detail}</p>
      </div>
    </div>
  )
}

function Detail({
  label,
  className,
  children,
}: {
  label: string
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn('grid gap-0.5', className)}>
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="font-medium">{children || '—'}</dd>
    </div>
  )
}

type Group = { label: string; items: string[]; typed?: boolean }

/** The free text typed under "Others", as its own group. */
const typedIn = (text: string | null): Group[] =>
  text ? [{ label: 'Others', items: [text], typed: true }] : []

/** "4", "4 in Camiguin", "4 + others", or undefined when there is nothing. */
function summary(count: number, other: string | null, where?: string) {
  if (count === 0) return other ? 'Others only' : undefined
  return [count, where, other && '+ others'].filter(Boolean).join(' ')
}

/**
 * One kind of who-or-where: chips, split into labelled groups when there is more than one
 * (DOH and partners, provinces, typed-in others). Typed-in text gets a dashed chip.
 */
function WhoRow({
  icon: Icon,
  label,
  summary,
  groups,
}: {
  icon: LucideIcon
  label: string
  summary?: string
  groups: Group[]
}) {
  const shown = groups.filter((group) => group.items.length > 0)
  return (
    <div className="grid gap-3 p-4 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4">
      <div className="flex items-start gap-2">
        <Icon
          aria-hidden
          className="mt-0.5 size-4 shrink-0 text-primary dark:text-accent-foreground"
        />
        <div>
          <h3 className="font-semibold">{label}</h3>
          {summary && <p className="text-muted-foreground text-xs">{summary}</p>}
        </div>
      </div>
      {shown.length === 0 ? (
        <p className="text-muted-foreground">None listed</p>
      ) : (
        <div className="grid gap-3">
          {shown.map((group) => (
            <div key={group.label} className="grid gap-1.5">
              {shown.length > 1 && (
                <h4 className="font-bold text-muted-foreground text-xs uppercase tracking-wide">
                  {group.label}
                </h4>
              )}
              <ul className="flex flex-wrap items-start gap-1.5">
                {group.items.map((item) => (
                  <li
                    key={item}
                    className={cn(
                      'rounded-full border px-2.5 py-0.5 text-xs',
                      group.typed ? 'whitespace-pre-wrap border-dashed' : 'bg-muted'
                    )}
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
