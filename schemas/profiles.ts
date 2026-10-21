import { z } from 'zod'
import { Role } from '@/generated/prisma/enums'
import { passwordSchema, usernameSchema } from '@/schemas/auth'

const name = (label: string) =>
  z
    .string()
    .trim()
    .min(2, `${label} must be at least 2 characters`)
    .max(50, `${label} must be at most 50 characters`)

/** The fields a user may edit on their own profile, and an admin on anyone's. */
export const profileSchema = z.object({
  firstName: name('First name'),
  middleName: z.union([z.literal(''), name('Middle name')]),
  lastName: name('Last name'),
  username: usernameSchema,
  position: z
    .string()
    .trim()
    .min(4, 'Position must be at least 4 characters')
    .max(30, 'Position must be at most 30 characters'),
  sectionId: z.number({ error: 'Choose a section' }).int().positive('Choose a section'),
})

export const createProfileSchema = profileSchema.extend({
  password: passwordSchema,
  role: z.enum(Role),
})

export const setRoleSchema = z.enum(Role)

export const setPasswordSchema = z.object({ password: passwordSchema })

export const changeOwnPasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export type CreateProfileInput = z.input<typeof createProfileSchema>
export type SetPasswordInput = z.input<typeof setPasswordSchema>
export type ChangeOwnPasswordInput = z.input<typeof changeOwnPasswordSchema>
