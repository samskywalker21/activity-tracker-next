import { Plus } from 'lucide-react'
import Link from 'next/link'
import { PageHeader } from '@/components/page-header'
import { RecentActivitiesTable } from '@/components/recent-activities-table'
import { Button } from '@/components/ui/button'
import { formatRange } from '@/lib/dates'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/session'

export default async function DashboardPage() {
  const user = await requireUser()
  const activities = await db.activity.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: { section: { select: { code: true } } },
  })

  const rows = activities.map((activity) => ({
    id: activity.id,
    title: activity.title,
    when: formatRange(activity.start, activity.end, activity.allDay),
    section: activity.section.code,
    status: activity.status,
  }))

  return (
    <>
      <PageHeader
        title={`Good day, ${user.firstName}`}
        description="The latest activities filed across the office."
        actions={
          <Button nativeButton={false} render={<Link href="/activities/new" />}>
            <Plus data-icon="inline-start" />
            New activity
          </Button>
        }
      />
      <section className="flex flex-col gap-3">
        <h2 className="font-bold text-lg">Recent activities</h2>
        <RecentActivitiesTable rows={rows} />
      </section>
    </>
  )
}
