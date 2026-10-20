import { z } from 'zod'

const name = (label: string) =>
  z
    .string()
    .trim()
    .min(2, `${label} must be at least 2 characters`)
    .max(50, `${label} must be at most 50 characters`)

export const usernameSchema = z
  .string()
  .trim()
  .min(4, 'Username must be at least 4 characters')
  .max(100, 'Username must be at most 100 characters')
  .regex(/^[a-zA-Z0-9_.]+$/, 'Use only letters, numbers, dots and underscores')

export const passwordSchema = z
  .string()
  .min(4, 'Password must be at least 4 characters')
  .max(100, 'Password must be at most 100 characters')

export const signInSchema = z.object({
  username: z.string().trim().min(1, 'Enter your username'),
  password: z.string().min(1, 'Enter your password'),
})

export const signUpSchema = z
  .object({
    firstName: name('First name'),
    middleName: z.union([z.literal(''), name('Middle name')]),
    lastName: name('Last name'),
    position: z
      .string()
      .trim()
      .min(4, 'Position must be at least 4 characters')
      .max(30, 'Position must be at most 30 characters'),
    sectionId: z.number({ error: 'Choose your section' }).int().positive('Choose your section'),
    username: usernameSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export type SignInInput = z.infer<typeof signInSchema>
export type SignUpInput = z.infer<typeof signUpSchema>
