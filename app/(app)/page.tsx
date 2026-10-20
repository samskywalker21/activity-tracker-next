import { cn } from 'cn'
import { ClipboardCheck, Plus, Undo2 } from 'lucide-react'
import Link from 'next/link'
import { createLoader, parseAsStringLiteral } from 'nuqs/server'
import { ActivitiesTable } from '@/components/activities/activities-table'
import { TabsFilter } from '@/components/filter-bar'
import { PageHeader } from '@/components/page-header'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import type { ActivityStatus } from '@/generated/prisma/enums'
import { activityOrder, activityRowInclude, toActivityRow } from '@/lib/activity-list'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/session'
import { statusDotClasses, statusLabels } from '@/lib/status'

const cards: { status: ActivityStatus; description: string }[] = [
  { status: 'PENDING', description: 'Waiting for review' },
  { status: 'APPROVED', description: 'Approved and on the calendar' },
  { status: 'RETURNED', description: 'Sent back to you for changes' },
]

// Recent activity is the user's own section unless they ask for all; admins always see all.
const loadScope = createLoader({
  recent: parseAsStringLiteral(['section', 'all']).withDefault('section'),
})

export default async function DashboardPage({ searchParams }: PageProps<'/'>) {
  const user = await requireUser()
  const isReviewer = user.role === 'ADMIN' || user.role === 'MANAGER'
  const isAdmin = user.role === 'ADMIN'
  const sectionOnly = !isAdmin && loadScope(await searchParams).recent === 'section'

  const [counts, returned, reviewQueue, recent] = await Promise.all([
    db.activity.groupBy({ by: ['status'], where: { createdById: user.id }, _count: true }),
    db.activity.findMany({
      where: { createdById: user.id, status: 'RETURNED' },
      orderBy: activityOrder,
      include: {
        // The event that returned it carries the reviewer's reason.
        events: { where: { toStatus: 'RETURNED' }, orderBy: { id: 'desc' }, take: 1 },
      },
    }),
    isReviewer ? db.activity.count({ where: { status: 'PENDING' } }) : 0,
    db.activity.findMany({
      where: sectionOnly ? { sectionId: user.sectionId } : {},
      orderBy: activityOrder,
      take: 10,
      include: activityRowInclude,
    }),
  ])

  return (
    <>
      <PageHeader
        title={`Good day, ${user.firstName}`}
        description="Where your activities stand, and what needs you."
        actions={
          <Button nativeButton={false} render={<Link href="/activities/new" />}>
            <Plus data-icon="inline-start" />
            New activity
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map(({ status, description }) => (
          <Link
            key={status}
            href={status === 'PENDING' ? '/my-activities' : `/my-activities?status=${status}`}
            className="rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Card className="h-full transition-colors hover:bg-muted/50">
              <CardHeader>
                <CardDescription className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className={cn('size-2 rounded-full', statusDotClasses[status])}
                  />
                  {statusLabels[status]}
                </CardDescription>
                <CardTitle className="font-bold text-3xl tabular-nums">
                  {counts.find((c) => c.status === status)?._count ?? 0}
                </CardTitle>
                <CardDescription>{description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>

      {(reviewQueue > 0 || returned.length > 0) && (
        <section className="flex flex-col gap-3">
          <h2 className="font-bold text-lg">Needs your attention</h2>
          {reviewQueue > 0 && (
            <Alert>
              <ClipboardCheck />
              <AlertTitle>
                {reviewQueue} {reviewQueue === 1 ? 'activity is' : 'activities are'} waiting for
                review
              </AlertTitle>
              <AlertAction>
                <Button size="sm" nativeButton={false} render={<Link href="/review" />}>
                  Review
                </Button>
              </AlertAction>
            </Alert>
          )}
          {returned.map((activity) => (
            <Alert key={activity.id}>
              <Undo2 />
              <AlertTitle>Returned: {activity.title}</AlertTitle>
              <AlertDescription>
                {activity.events[0]?.note
                  ? `“${activity.events[0].note}”`
                  : 'No reason was recorded.'}
              </AlertDescription>
              <AlertAction>
                <Button
                  size="sm"
                  variant="outline"
                  nativeButton={false}
                  render={<Link href={`/activities/${activity.id}`} />}
                >
                  Open
                </Button>
              </AlertAction>
            </Alert>
          ))}
        </section>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold text-lg">Recent activity</h2>
          {!isAdmin && (
            <TabsFilter
              name="recent"
              label="Show"
              items={[
                { value: 'section', label: 'My section' },
                { value: 'all', label: 'All activities' },
              ]}
            />
          )}
        </div>
        <ActivitiesTable
          rows={recent.map(toActivityRow)}
          empty={
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Plus />
                </EmptyMedia>
                <EmptyTitle>No activities yet</EmptyTitle>
                <EmptyDescription>
                  {sectionOnly
                    ? 'Activities filed for your section will show up here.'
                    : 'Activities you and your colleagues file will show up here.'}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          }
        />
      </section>
    </>
  )
}
