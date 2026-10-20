import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { SignUpForm } from '@/components/auth/sign-up-form'
import { db } from '@/lib/db'
import { getOptionalUser } from '@/lib/session'

export const metadata: Metadata = { title: 'Sign up · Activity Tracker' }

export default async function SignUpPage() {
  if (await getOptionalUser()) redirect('/')

  const sections = await db.section.findMany({
    where: { isActive: true },
    select: { id: true, code: true, name: true },
    orderBy: { name: 'asc' },
  })

  return <SignUpForm sections={sections} />
}
