'use client'

import 'temporal-polyfill/global'
import '@schedule-x/theme-default/dist/index.css'
import {
  type BackgroundEvent,
  type CalendarType,
  createViewMonthAgenda,
  createViewMonthGrid,
} from '@schedule-x/calendar'
import { ScheduleXCalendar, useNextCalendarApp } from '@schedule-x/react'
import { cn } from 'cn'
import { CalendarDays, ClipboardCheck } from 'lucide-react'
import Link from 'next/link'
import { useTheme } from 'next-themes'
import { parseAsStringLiteral, useQueryStates } from 'nuqs'
import { type ReactNode, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { type CalendarActivity, getCalendarRange } from '@/actions/calendar'
import { FilterBar, SelectFilter } from '@/components/filter-bar'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ActivityType } from '@/generated/prisma/enums'
import { APP_TIMEZONE } from '@/lib/dates'
import { authHref } from '@/lib/next-path'
import { CALENDAR_STATUSES } from '@/lib/rules'
import { statusLabels, typeLabels } from '@/lib/status'

type CalendarStatus = (typeof CALENDAR_STATUSES)[number]
type Range = { start: Temporal.ZonedDateTime; end: Temporal.ZonedDateTime }

/** Whose activities: remembered per browser. Guests have no section, so always see everyone's. */
type Scope = 'section' | 'division' | 'all'
const SCOPE_KEY = 'calendar-scope'
const isScope = (value: unknown): value is Scope =>
  value === 'section' || value === 'division' || value === 'all'

// schedule-x colours the phone view's dots from a "calendar" per status.
const statusCalendars: Record<string, CalendarType> = Object.fromEntries(
  CALENDAR_STATUSES.map((status) => {
    const main = `var(--status-${status.toLowerCase()})`
    const colors = {
      main,
      container: `color-mix(in oklab, ${main} 12%, var(--card))`,
      onContainer: 'var(--foreground)',
    }
    return [status, { colorName: status.toLowerCase(), lightColors: colors, darkColors: colors }]
  })
)

// Full class names so Tailwind picks them up.
const chipClasses: Record<CalendarStatus, string> = {
  APPROVED: 'border-status-approved bg-status-approved/10',
  PENDING: 'border-status-pending bg-status-pending/10',
}
const typeIcons = { EVENT: CalendarDays, MONITORING: ClipboardCheck }

// A background event takes a style object, not a class; the legend uses it too.
const holidayStyle = {
  backgroundColor: 'color-mix(in oklab, var(--gold) 12%, transparent)',
  backgroundImage:
    'repeating-linear-gradient(135deg, color-mix(in oklab, var(--gold) 35%, transparent) 0 1px, transparent 1px 7px)',
}

const typeItems = Object.values(ActivityType).map((t) => ({ value: t, label: typeLabels[t] }))
const statusItems = CALENDAR_STATUSES.map((s) => ({ value: s, label: statusLabels[s] }))

function EventChip({ activity, children }: { activity: CalendarActivity; children: ReactNode }) {
  const TypeIcon = typeIcons[activity.type]
  return (
    <span
      className={cn(
        'flex w-full min-w-0 items-center gap-1.5 rounded-sm border-l-4 pl-1',
        chipClasses[activity.status as CalendarStatus]
      )}
    >
      <TypeIcon aria-hidden className="size-3.5 shrink-0" />
      <span className="sr-only">{typeLabels[activity.type]}:</span>
      {children}
    </span>
  )
}

type EventProps = { calendarEvent: { activity: CalendarActivity } }

// From md: a chip in the grid. Below md the grid shows dots and the tapped day lists here.
// schedule-x wraps each in its own focusable button, which opens the details dialog.
const customComponents = {
  monthGridEvent: ({ calendarEvent }: EventProps) => (
    <EventChip activity={calendarEvent.activity}>
      <span className="truncate py-0.5 pr-1.5 font-medium text-xs">
        {calendarEvent.activity.title}
      </span>
    </EventChip>
  ),
  monthAgendaEvent: ({ calendarEvent }: EventProps) => (
    <EventChip activity={calendarEvent.activity}>
      <span className="flex min-w-0 flex-1 items-center justify-between gap-2 py-1.5 pr-2 text-sm">
        <span className="truncate font-medium">{calendarEvent.activity.title}</span>
        <StatusBadge status={calendarEvent.activity.status} />
      </span>
    </EventChip>
  ),
}

/** What a click on an activity shows; the full page is for signed-in users only. */
function ActivitySummary({
  activity,
  signedIn,
  onClose,
}: {
  activity: CalendarActivity | null
  signedIn: boolean
  onClose: () => void
}) {
  return (
    <Dialog open={activity !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        {activity && (
          <>
            <DialogHeader>
              <DialogTitle>{activity.title}</DialogTitle>
              <DialogDescription>{activity.when}</DialogDescription>
            </DialogHeader>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Status</dt>
              <dd>
                <StatusBadge status={activity.status} />
              </dd>
              <dt className="text-muted-foreground">Venue</dt>
              <dd>{activity.venue}</dd>
              <dt className="text-muted-foreground">Section</dt>
              <dd>{activity.section}</dd>
              <dt className="text-muted-foreground">Type</dt>
              <dd>{typeLabels[activity.type]}</dd>
            </dl>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>Close</DialogClose>
              {signedIn ? (
                <Button nativeButton={false} render={<Link href={`/activities/${activity.id}`} />}>
                  Open
                </Button>
              ) : (
                <Button
                  nativeButton={false}
                  render={<Link href={authHref('/sign-in', `/activities/${activity.id}`)} />}
                >
                  Sign in to see more
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function ActivityCalendar({
  holidays,
  home,
}: {
  holidays: { name: string; startDay: string; endDay: string }[]
  /** The signed-in user's section and division; null for a guest. */
  home: { section: { id: number; code: string }; division: { id: number; code: string } } | null
}) {
  const [{ status, type }] = useQueryStates({
    status: parseAsStringLiteral(CALENDAR_STATUSES),
    type: parseAsStringLiteral(Object.values(ActivityType)),
  })
  const [scope, setScope] = useState<Scope>(home ? 'section' : 'all')
  const [range, setRange] = useState<Range | null>(null)
  const [selected, setSelected] = useState<CalendarActivity | null>(null)
  const { resolvedTheme } = useTheme()

  const calendarApp = useNextCalendarApp({
    timezone: APP_TIMEZONE,
    views: [createViewMonthGrid(), createViewMonthAgenda()],
    calendars: statusCalendars,
    firstDayOfWeek: 7,
    showWeekNumbers: true,
    isDark: resolvedTheme === 'dark',
    backgroundEvents: holidays.map(
      (holiday): BackgroundEvent => ({
        title: holiday.name,
        start: Temporal.PlainDate.from(holiday.startDay),
        end: Temporal.PlainDate.from(holiday.endDay),
        style: holidayStyle,
      })
    ),
    callbacks: {
      // The app's md breakpoint, rather than schedule-x's own 700px.
      isCalendarSmall: () => !window.matchMedia('(width >= 48rem)').matches,
      onRender: ($app) => setRange($app.calendarState.range.value),
      onRangeUpdate: setRange,
      onEventClick: (event) => setSelected(event.activity),
    },
  })

  // Restore the remembered scope; the calendar fetches once the first range arrives, after this.
  useEffect(() => {
    if (!home) return
    try {
      const saved = localStorage.getItem(SCOPE_KEY)
      if (isScope(saved)) setScope(saved)
    } catch {}
  }, [home])

  useEffect(() => {
    calendarApp?.setTheme(resolvedTheme === 'dark' ? 'dark' : 'light')
  }, [calendarApp, resolvedTheme])

  const section = scope === 'section' ? home?.section.id : undefined
  const division = scope === 'division' ? home?.division.id : undefined

  useEffect(() => {
    if (!calendarApp || !range) return
    let current = true
    getCalendarRange({
      start: new Date(range.start.epochMilliseconds),
      end: new Date(range.end.epochMilliseconds),
      status: status ?? undefined,
      type: type ?? undefined,
      section,
      division,
    }).then((result) => {
      // A newer range or filter has been asked for since; its own fetch will set the events.
      if (!current) return
      if (!result.ok) return toast.error("Couldn't load the calendar")
      calendarApp.events.set(
        result.data.map((activity) => ({
          id: activity.id,
          title: activity.title,
          // Whole days: the grid shows what is on which day; the dialog gives the times.
          start: Temporal.PlainDate.from(activity.startDay),
          end: Temporal.PlainDate.from(activity.endDay),
          calendarId: activity.status,
          activity,
        }))
      )
    })
    return () => {
      current = false
    }
  }, [calendarApp, range, status, type, section, division])

  const scopeItems = home && [
    { value: 'section', label: `My section (${home.section.code})` },
    { value: 'division', label: `My division (${home.division.code})` },
    { value: 'all', label: 'Everyone' },
  ]

  function changeScope(value: Scope) {
    setScope(value)
    try {
      localStorage.setItem(SCOPE_KEY, value)
    } catch {}
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <FilterBar>
          {scopeItems && (
            <Select
              items={scopeItems}
              value={scope}
              onValueChange={(value) => isScope(value) && changeScope(value)}
            >
              <SelectTrigger aria-label="Whose activities" className="h-9 w-full bg-card sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {scopeItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <SelectFilter name="status" label="Statuses" items={statusItems} />
          <SelectFilter name="type" label="Types" items={typeItems} />
        </FilterBar>
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground text-sm">
          {CALENDAR_STATUSES.map((s) => (
            <li key={s} className="flex items-center gap-1.5">
              <span aria-hidden className={cn('size-3.5 rounded-sm border-l-4', chipClasses[s])} />
              {statusLabels[s]}
            </li>
          ))}
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="size-3.5 rounded-sm border" style={holidayStyle} />
            Holiday
          </li>
        </ul>
      </div>
      <ScheduleXCalendar calendarApp={calendarApp} customComponents={customComponents} />
      <ActivitySummary
        activity={selected}
        signedIn={home !== null}
        onClose={() => setSelected(null)}
      />
    </div>
  )
}
