import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { SignUpForm } from '@/components/auth/sign-up-form'
import { db } from '@/lib/db'
import { safeNextPath } from '@/lib/next-path'
import { getOptionalUser } from '@/lib/session'

export const metadata: Metadata = { title: 'Sign up · Activity Tracker' }

export default async function SignUpPage({ searchParams }: PageProps<'/sign-up'>) {
  const next = safeNextPath((await searchParams).next)
  if (await getOptionalUser()) redirect(next)

  const sections = await db.section.findMany({
    where: { isActive: true },
    select: { id: true, code: true, name: true, division: { select: { name: true } } },
    orderBy: [{ division: { name: 'asc' } }, { name: 'asc' }],
  })

  return <SignUpForm sections={sections} next={next} />
}
