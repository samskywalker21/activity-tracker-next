import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import type { Role } from '@/generated/prisma/enums'
import { auth } from '@/lib/auth'

/** The signed-in, active user, or null. Cached per request. */
export const getOptionalUser = cache(async () => {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user.isActive) return null
  return session.user
})

export async function requireUser() {
  const user = await getOptionalUser()
  if (!user) redirect('/sign-in')
  return user
}

export async function requireRole(roles: Role[]) {
  const user = await requireUser()
  if (!roles.includes(user.role)) throw new Error('You do not have permission to do that')
  return user
}
