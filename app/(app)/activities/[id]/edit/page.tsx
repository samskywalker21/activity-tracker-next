import { notFound, redirect } from 'next/navigation'
import { ActivityForm } from '@/components/activities/activity-form'
import { PageHeader } from '@/components/page-header'
import { formatDay, formatTime } from '@/lib/dates'
import { db } from '@/lib/db'
import { canEdit, statusAfterEdit } from '@/lib/rules'
import { requireUser } from '@/lib/session'
import { loadFormOptions } from '../../form-options'

export default async function EditActivityPage({ params }: PageProps<'/activities/[id]/edit'>) {
  const user = await requireUser()
  const id = Number((await params).id)
  if (!Number.isInteger(id)) notFound()

  const activity = await db.activity.findUnique({
    where: { id },
    include: {
      participants: { select: { id: true } },
      lgus: { select: { id: true } },
      facilities: { select: { id: true } },
    },
  })
  if (!activity) notFound()
  if (!canEdit(user, activity)) redirect(`/activities/${id}`)

  const participantIds = activity.participants.map((p) => p.id)
  const lguIds = activity.lgus.map((l) => l.id)
  const facilityIds = activity.facilities.map((f) => f.id)
  const options = await loadFormOptions({
    sectionId: activity.sectionId,
    participantIds,
    lguIds,
    facilityIds,
  })

  let notice: string | undefined
  if (statusAfterEdit(user, activity) !== activity.status) {
    notice =
      activity.status === 'RETURNED'
        ? 'Saving resubmits this activity for review.'
        : 'This activity is approved. Saving your changes sends it back for review.'
  }

  return (
    <>
      <PageHeader title="Edit activity" description={activity.title} />
      <ActivityForm
        id={id}
        options={options}
        notice={notice}
        defaultValues={{
          title: activity.title,
          type: activity.type,
          virtual: activity.virtual,
          allDay: activity.allDay,
          startDate: formatDay(activity.start),
          startTime: activity.allDay ? '08:00' : formatTime(activity.start),
          endDate: formatDay(activity.end),
          endTime: activity.allDay ? '17:00' : formatTime(activity.end),
          sectionId: activity.sectionId,
          owner: activity.owner,
          venue: activity.venue,
          prNo: activity.prNo ?? '',
          otherParticipants: activity.otherParticipants ?? '',
          otherLgu: activity.otherLgu ?? '',
          otherFacilities: activity.otherFacilities ?? '',
          remarks: activity.remarks ?? '',
          participantIds,
          lguIds,
          facilityIds,
        }}
      />
    </>
  )
}
