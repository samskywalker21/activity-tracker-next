import { ActivityForm } from '@/components/activities/activity-form'
import { PageHeader } from '@/components/page-header'
import { requireUser } from '@/lib/session'
import { loadFormOptions } from '../form-options'

export default async function NewActivityPage() {
  const user = await requireUser()
  const options = await loadFormOptions({ sectionId: user.sectionId })

  return (
    <>
      <PageHeader title="New activity" description="It goes to a reviewer once you submit it." />
      <ActivityForm
        options={options}
        defaultValues={{
          title: '',
          virtual: false,
          allDay: false,
          startDate: '',
          startTime: '08:00',
          endDate: '',
          endTime: '17:00',
          sectionId: user.sectionId,
          owner: user.name,
          venue: '',
          prNo: '',
          otherParticipants: '',
          otherLgu: '',
          otherFacilities: '',
          remarks: '',
          participantIds: [],
          lguIds: [],
          facilityIds: [],
        }}
      />
    </>
  )
}
