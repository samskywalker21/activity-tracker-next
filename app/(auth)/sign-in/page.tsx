import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { SignInForm } from '@/components/auth/sign-in-form'
import { safeNextPath } from '@/lib/next-path'
import { getOptionalUser } from '@/lib/session'

export const metadata: Metadata = { title: 'Sign in · Activity Tracker' }

export default async function SignInPage({ searchParams }: PageProps<'/sign-in'>) {
  const next = safeNextPath((await searchParams).next)
  if (await getOptionalUser()) redirect(next)
  return <SignInForm next={next} />
}
