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

/** A short human range in APP_TIMEZONE, e.g. "Oct 27, 2026 · 1:00–5:00 PM". */
export function formatRange(start: Date, end: Date, allDay: boolean) {
  const s = zoned(start)
  const e = zoned(end)

  if (allDay) {
    if (isSameDay(s, e)) return `${format(s, 'MMM d, yyyy')} · All day`
    if (isSameMonth(s, e)) return `${format(s, 'MMM d')}–${format(e, 'd, yyyy')} · All day`
    if (isSameYear(s, e)) return `${format(s, 'MMM d')} – ${format(e, 'MMM d, yyyy')} · All day`
    return `${format(s, 'MMM d, yyyy')} – ${format(e, 'MMM d, yyyy')} · All day`
  }

  if (isSameDay(s, e)) {
    const times =
      format(s, 'a') === format(e, 'a')
        ? `${format(s, 'h:mm')}–${format(e, 'h:mm a')}`
        : `${format(s, 'h:mm a')} – ${format(e, 'h:mm a')}`
    return `${format(s, 'MMM d, yyyy')} · ${times}`
  }
  return `${format(s, 'MMM d, yyyy, h:mm a')} – ${format(e, 'MMM d, yyyy, h:mm a')}`
}
