import { z } from 'zod'
import { ActivityType } from '@/generated/prisma/enums'
import { dayBounds, parseDateTime, parseDay } from '@/lib/dates'
import { CALENDAR_STATUSES, NOTE_REQUIRED } from '@/lib/rules'

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a date')
const time = z.string().regex(/^\d{2}:\d{2}$/, 'Enter a time')

const text = (label: string) =>
  z
    .string()
    .trim()
    .min(4, `${label} must be at least 4 characters`)
    .max(200, `${label} must be at most 200 characters`)
const optionalText = z.string().trim().max(2000, 'Keep it under 2000 characters')

/**
 * Start and end as the form holds them: day strings, wall-clock times in APP_TIMEZONE (ignored
 * when `allDay`). Same-format strings compare correctly as text.
 */
const range = z.object({
  allDay: z.boolean(),
  startDate: day,
  startTime: time,
  endDate: day,
  endTime: time,
})

const endNotBeforeStart = (data: z.infer<typeof range>) =>
  data.allDay
    ? data.endDate >= data.startDate
    : `${data.endDate}T${data.endTime}` >= `${data.startDate}T${data.startTime}`
const ORDER_ERROR = { message: 'End cannot be before the start', path: ['endDate'] }

const pivots = {
  participantIds: z.array(z.number().int()),
  lguIds: z.array(z.string()),
  facilityIds: z.array(z.number().int()),
}

export const activitySchema = range
  .extend({
    title: text('Title'),
    type: z.enum(ActivityType, 'Choose a type'),
    virtual: z.boolean(),
    sectionId: z.number({ error: 'Choose a section' }).int().positive('Choose a section'),
    owner: text('Owner'),
    venue: text('Venue'),
    prNo: z.string().trim().max(50, 'PR number must be at most 50 characters'),
    otherParticipants: optionalText,
    otherLgu: optionalText,
    otherFacilities: optionalText,
    remarks: optionalText,
    ...pivots,
  })
  .refine(endNotBeforeStart, ORDER_ERROR)

/** What the live conflict check sends: the range, the selections, and the activity being edited. */
export const conflictCheckSchema = range
  .extend({ id: z.number().int().optional(), ...pivots })
  .refine(endNotBeforeStart, ORDER_ERROR)

export const statusChangeSchema = z
  .object({
    status: z.enum(['APPROVED', 'RETURNED', 'REJECTED', 'CANCELLED'], 'Choose a decision'),
    note: z.string().trim().max(2000, 'Keep it under 2000 characters'),
  })
  .refine((data) => !NOTE_REQUIRED.includes(data.status) || data.note.length > 0, {
    message: 'Give a reason',
    path: ['note'],
  })

export const commentSchema = z.object({
  body: z.string().trim().min(1, 'Write a comment').max(2000, 'Keep it under 2000 characters'),
})

/** The calendar's visible window (instants) and its filters. */
export const calendarRangeSchema = z.object({
  start: z.date(),
  end: z.date(),
  status: z.enum(CALENDAR_STATUSES).optional(),
  type: z.enum(ActivityType).optional(),
  section: z.number().int().optional(),
  division: z.number().int().optional(),
})

/** The instants a form range stands for: whole days when `allDay`. */
export function rangeToDates(data: z.infer<typeof range>) {
  if (data.allDay) return dayBounds(parseDay(data.startDate), parseDay(data.endDate))
  return {
    start: parseDateTime(data.startDate, data.startTime),
    end: parseDateTime(data.endDate, data.endTime),
  }
}

export type ActivityInput = z.input<typeof activitySchema>
export type StatusChangeInput = z.input<typeof statusChangeSchema>
export type CommentInput = z.input<typeof commentSchema>
export type CalendarRangeInput = z.input<typeof calendarRangeSchema>
