import { TZDate } from '@date-fns/tz'
import { endOfDay, format, isSameDay, isSameMonth, isSameYear, startOfDay } from 'date-fns'

// One zone for server and calendar alike; dates are stored as timestamptz (UTC instants).
export const APP_TIMEZONE = process.env.APP_TIMEZONE ?? 'Asia/Manila'

const zoned = (date: Date) => new TZDate(date, APP_TIMEZONE)

/** Start of `start`'s day and end of `end`'s day, in APP_TIMEZONE. Used for all-day ranges. */
export function dayBounds(start: Date, end: Date = start) {
  return {
    start: new Date(startOfDay(zoned(start)).getTime()),
    end: new Date(endOfDay(zoned(end)).getTime()),
  }
}

/** The days a range covers in APP_TIMEZONE, e.g. "Oct 23–24, 2026". */
export function formatDays(start: Date, end: Date) {
  const s = zoned(start)
  const e = zoned(end)
  if (isSameDay(s, e)) return format(s, 'MMM d, yyyy')
  if (isSameMonth(s, e)) return `${format(s, 'MMM d')}–${format(e, 'd, yyyy')}`
  if (isSameYear(s, e)) return `${format(s, 'MMM d')} – ${format(e, 'MMM d, yyyy')}`
  return `${format(s, 'MMM d, yyyy')} – ${format(e, 'MMM d, yyyy')}`
}

/** A short human range in APP_TIMEZONE, e.g. "Oct 27, 2026 · 1:00–5:00 PM". */
export function formatRange(start: Date, end: Date, allDay: boolean) {
  if (allDay) return `${formatDays(start, end)} · All day`

  const s = zoned(start)
  const e = zoned(end)

  if (isSameDay(s, e)) {
    const times =
      format(s, 'a') === format(e, 'a')
        ? `${format(s, 'h:mm')}–${format(e, 'h:mm a')}`
        : `${format(s, 'h:mm a')} – ${format(e, 'h:mm a')}`
    return `${format(s, 'MMM d, yyyy')} · ${times}`
  }
  return `${format(s, 'MMM d, yyyy, h:mm a')} – ${format(e, 'MMM d, yyyy, h:mm a')}`
}

/** A `yyyy-MM-dd` day in APP_TIMEZONE, as the instant it starts. Used by date-only fields. */
export function parseDay(day: string) {
  const [year, month, date] = day.split('-').map(Number)
  return new Date(new TZDate(year, month - 1, date, APP_TIMEZONE).getTime())
}

/** The `yyyy-MM-dd` day an instant falls on in APP_TIMEZONE. */
export function formatDay(date: Date) {
  return format(zoned(date), 'yyyy-MM-dd')
}

/** A `yyyy-MM-dd` day and an `HH:mm` wall-clock time in APP_TIMEZONE, as an instant. */
export function parseDateTime(day: string, time: string) {
  const [year, month, date] = day.split('-').map(Number)
  const [hours, minutes] = time.split(':').map(Number)
  return new Date(new TZDate(year, month - 1, date, hours, minutes, APP_TIMEZONE).getTime())
}

/** The `HH:mm` wall-clock time of an instant in APP_TIMEZONE. */
export function formatTime(date: Date) {
  return format(zoned(date), 'HH:mm')
}

/** An instant as `Oct 27, 2026, 1:30 PM` in APP_TIMEZONE. */
export function formatDateTime(date: Date) {
  return format(zoned(date), 'MMM d, yyyy, h:mm a')
}

const isDay = (value: string | null | undefined): value is string =>
  !!value && /^\d{4}-\d{2}-\d{2}$/.test(value)

/**
 * Whole days `from`–`to` (`yyyy-MM-dd` from the URL, either optional) as a Prisma date filter.
 * Undefined when neither is a valid day, so bad input is ignored rather than refused.
 */
export function dayRangeFilter(from: string | null | undefined, to: string | null | undefined) {
  if (!isDay(from) && !isDay(to)) return undefined
  return {
    ...(isDay(from) && { gte: dayBounds(parseDay(from)).start }),
    ...(isDay(to) && { lte: dayBounds(parseDay(to)).end }),
  }
}
