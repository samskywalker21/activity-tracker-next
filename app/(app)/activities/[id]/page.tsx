import { Pencil } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import { Comments } from '@/components/activities/comments'
import { StatusDialog } from '@/components/activities/status-dialog'
import { PageHeader } from '@/components/page-header'
import { StatusBadge } from '@/components/status-badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatDateTime, formatRange } from '@/lib/dates'
import { db } from '@/lib/db'
import { allowedTransitions, canEdit } from '@/lib/rules'
import { requireUser } from '@/lib/session'
import { statusLabels, typeLabels } from '@/lib/status'

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
      events: { include: { actor: { select: { name: true } } }, orderBy: { id: 'desc' } },
      comments: { include: { author: { select: { name: true } } }, orderBy: { id: 'asc' } },
    },
  })
  if (!activity) notFound()

  const allowed = allowedTransitions(user, activity)
  // The event that set the current status carries the reason the creator needs to read.
  const decision =
    activity.status in decidedLabels
      ? activity.events.find((event) => event.toStatus === activity.status)
      : undefined

  return (
    <>
      <PageHeader
        title={activity.title}
        description={formatRange(activity.start, activity.end, activity.allDay)}
        actions={
          <>
            <StatusBadge status={activity.status} />
            {canEdit(user, activity) && (
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href={`/activities/${id}/edit`} />}
              >
                <Pencil /> Edit
              </Button>
            )}
            {allowed.length > 0 && <StatusDialog id={id} allowed={allowed} />}
          </>
        }
      />

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

      <Card>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Detail label="Type">
              {typeLabels[activity.type]}
              {activity.virtual && ' · Online'}
            </Detail>
            <Detail label="Section">
              {activity.section.code} – {activity.section.name}
            </Detail>
            <Detail label="Owner">{activity.owner}</Detail>
            <Detail label="Venue">{activity.venue}</Detail>
            <Detail label="PR number">{activity.prNo}</Detail>
            <Detail label="Created by">
              {activity.createdBy.name} · {formatDateTime(activity.createdAt)}
            </Detail>
            {activity.remarks && (
              <div className="sm:col-span-2 lg:col-span-3">
                <Detail label="Remarks">
                  <span className="whitespace-pre-wrap">{activity.remarks}</span>
                </Detail>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      <Tabs defaultValue="participants">
        <TabsList className="max-w-full overflow-x-auto">
          <TabsTrigger value="participants">
            Participants ({activity.participants.length})
          </TabsTrigger>
          <TabsTrigger value="lgus">LGUs ({activity.lgus.length})</TabsTrigger>
          <TabsTrigger value="facilities">Facilities ({activity.facilities.length})</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="comments">Comments ({activity.comments.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="participants">
          <NameList
            names={activity.participants.map((p) => p.name)}
            other={activity.otherParticipants}
          />
        </TabsContent>
        <TabsContent value="lgus">
          <NameList
            names={activity.lgus.map((l) => `${l.muncity}, ${l.province}`)}
            other={activity.otherLgu}
          />
        </TabsContent>
        <TabsContent value="facilities">
          <NameList
            names={activity.facilities.map((f) => f.name)}
            other={activity.otherFacilities}
          />
        </TabsContent>
        <TabsContent value="history">
          <ol className="grid gap-3">
            {activity.events.map((event) => (
              <li key={event.id} className="grid gap-0.5 rounded-lg border p-3 text-sm">
                <p>
                  <span className="font-medium">{event.actor.name}</span>{' '}
                  {event.fromStatus
                    ? `changed it from ${statusLabels[event.fromStatus]} to ${statusLabels[event.toStatus]}`
                    : 'submitted it'}
                </p>
                <p className="text-muted-foreground text-xs">{formatDateTime(event.createdAt)}</p>
                {event.note && <p className="whitespace-pre-wrap">{event.note}</p>}
              </li>
            ))}
          </ol>
        </TabsContent>
        <TabsContent value="comments">
          <Comments
            activityId={id}
            comments={activity.comments.map((comment) => ({
              id: comment.id,
              body: comment.body,
              author: comment.author.name,
              mine: comment.authorId === user.id,
              postedAt: formatDateTime(comment.createdAt),
              edited: comment.updatedAt.getTime() - comment.createdAt.getTime() > 1000,
            }))}
          />
        </TabsContent>
      </Tabs>
    </>
  )
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="font-medium">{children || '—'}</dd>
    </div>
  )
}

function NameList({ names, other }: { names: string[]; other: string | null }) {
  if (names.length === 0 && !other) {
    return <p className="text-muted-foreground text-sm">None.</p>
  }
  return (
    <div className="grid gap-3 text-sm">
      {names.length > 0 && (
        <ul className="list-disc pl-5">
          {names.map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
      )}
      {other && (
        <p className="whitespace-pre-wrap">
          <span className="text-muted-foreground">Others: </span>
          {other}
        </p>
      )}
    </div>
  )
}
