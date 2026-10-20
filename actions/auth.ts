'use server'

import { isAPIError } from 'better-auth/api'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { type ActionResult, validationFailed } from '@/lib/action-result'
import { auth, placeholderEmail } from '@/lib/auth'
import { db } from '@/lib/db'
import { signInSchema, signUpSchema } from '@/schemas/auth'

export async function signIn(input: unknown): Promise<ActionResult> {
  const parsed = signInSchema.safeParse(input)
  if (!parsed.success) return validationFailed(parsed.error)

  try {
    await auth.api.signInUsername({ body: parsed.data, headers: await headers() })
  } catch (error) {
    if (isAPIError(error)) return { ok: false, error: error.message }
    throw error
  }

  redirect('/')
}

export async function signUp(input: unknown): Promise<ActionResult> {
  const parsed = signUpSchema.safeParse(input)
  if (!parsed.success) return validationFailed(parsed.error)
  const { confirmPassword: _, middleName, ...data } = parsed.data

  const section = await db.section.findUnique({ where: { id: data.sectionId } })
  if (!section?.isActive) {
    return {
      ok: false,
      error: 'Choose your section',
      fieldErrors: { sectionId: ['Choose your section'] },
    }
  }

  try {
    await auth.api.signUpEmail({
      body: {
        ...data,
        middleName: middleName || undefined,
        name: `${data.firstName} ${data.lastName}`,
        email: placeholderEmail(data.username),
      },
      headers: await headers(),
    })
    await auth.api.signInUsername({
      body: { username: data.username, password: data.password },
      headers: await headers(),
    })
  } catch (error) {
    if (isAPIError(error)) return { ok: false, error: error.message }
    throw error
  }

  redirect('/')
}

export async function signOut() {
  await auth.api.signOut({ headers: await headers() })
  redirect('/sign-in')
}
