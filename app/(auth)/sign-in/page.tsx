import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { SignInForm } from '@/components/auth/sign-in-form'
import { getOptionalUser } from '@/lib/session'

export const metadata: Metadata = { title: 'Sign in · Activity Tracker' }

export default async function SignInPage() {
  if (await getOptionalUser()) redirect('/')
  return <SignInForm />
}
