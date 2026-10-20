import { z } from 'zod'

const code = z
  .string()
  .trim()
  .min(1, 'Enter a code')
  .max(10, 'Code must be at most 10 characters')
  .transform((value) => value.toUpperCase())

const name = (min: number) =>
  z
    .string()
    .trim()
    .min(min, `Name must be at least ${min} characters`)
    .max(200, 'Name must be at most 200 characters')

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a date')

export const divisionSchema = z.object({ code, name: name(3) })

export const sectionSchema = z.object({
  code,
  name: name(3),
  divisionId: z.number({ error: 'Choose a division' }).int().positive('Choose a division'),
})

export const lguSchema = z.object({
  id: z
    .string()
    .trim()
    .regex(/^\d{9}$/, 'Enter the 9-digit PSGC code'),
  muncity: name(3),
  provinceId: z.number({ error: 'Choose a province' }).int().positive('Choose a province'),
})

export const participantSchema = z.object({
  name: name(3),
  isInternal: z.boolean(),
})

export const facilitySchema = z.object({ name: name(3) })

export const holidaySchema = z
  .object({ name: name(3), start: day, end: day })
  // Same-format day strings compare correctly as text.
  .refine((data) => data.end >= data.start, {
    message: 'End date cannot be before the start date',
    path: ['end'],
  })

export type DivisionInput = z.input<typeof divisionSchema>
export type SectionInput = z.input<typeof sectionSchema>
export type LguInput = z.input<typeof lguSchema>
export type ParticipantInput = z.input<typeof participantSchema>
export type FacilityInput = z.input<typeof facilitySchema>
export type HolidayInput = z.input<typeof holidaySchema>
