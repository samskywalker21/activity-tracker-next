import { ArrowLeft, LogIn } from 'lucide-react'
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { ActivityCalendar } from '@/components/activities/activity-calendar'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import { formatDay } from '@/lib/dates'
import { db } from '@/lib/db'
import { getOptionalUser } from '@/lib/session'

export const metadata: Metadata = { title: 'Calendar · Activity Tracker' }

// Public: guests see the calendar too. Holidays are few, so they all come with the page.
export default async function CalendarPage() {
  const user = await getOptionalUser()
  const [holidays, section] = await Promise.all([
    db.holiday.findMany({ orderBy: { start: 'asc' } }),
    user
      ? db.section.findUniqueOrThrow({ where: { id: user.sectionId }, include: { division: true } })
      : null,
  ])

  return (
    <>
      <header className="flex h-15 items-center justify-between gap-2 border-b bg-card px-4 md:px-7">
        <Link href={user ? '/' : '/sign-in'} className="flex min-w-0 items-center gap-2">
          <Image
            src="/brand/doh-central.png"
            alt="Department of Health seal"
            width={28}
            height={28}
          />
          <Image
            src="/brand/chd-nm.png"
            alt="Center for Health Development – Northern Mindanao seal"
            width={28}
            height={28}
          />
          <h1 className="truncate font-bold text-lg">Activity Calendar</h1>
        </Link>
        <div className="flex shrink-0 items-center gap-1">
          <ThemeToggle />
          {user ? (
            <Button variant="outline" nativeButton={false} render={<Link href="/" />}>
              <ArrowLeft data-icon="inline-start" />
              Back
            </Button>
          ) : (
            <Button nativeButton={false} render={<Link href="/sign-in" />}>
              <LogIn data-icon="inline-start" />
              Sign in
            </Button>
          )}
        </div>
      </header>
      <main className="flex-1 p-4 md:p-7">
        <ActivityCalendar
          holidays={holidays.map((holiday) => ({
            name: holiday.name,
            startDay: formatDay(holiday.start),
            endDay: formatDay(holiday.end),
          }))}
          home={
            section && {
              section: { id: section.id, code: section.code },
              division: { id: section.division.id, code: section.division.code },
            }
          }
        />
      </main>
    </>
  )
}
