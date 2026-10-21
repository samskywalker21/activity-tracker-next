'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import Link from 'next/link'
import { useState, useTransition } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { signIn } from '@/actions/auth'
import { PasswordInput } from '@/components/auth/password-input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { authHref } from '@/lib/next-path'
import { type SignInInput, signInSchema } from '@/schemas/auth'

export function SignInForm({ next }: { next: string }) {
  const [error, setError] = useState<string>()
  const [pending, startTransition] = useTransition()
  const form = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    defaultValues: { username: '', password: '' },
  })

  function onSubmit(values: SignInInput) {
    setError(undefined)
    startTransition(async () => {
      // On success the action redirects, so a result only ever means failure.
      const result = await signIn(values, next)
      if (!result.ok) setError(result.error)
    })
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      noValidate
      className="w-full max-w-sm md:self-center"
    >
      <FieldGroup>
        <div className="flex flex-col gap-1.5">
          <h1 className="font-bold text-3xl">Sign in</h1>
          <p className="text-base text-muted-foreground">
            Use your Activity Tracker username and password.
          </p>
        </div>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <Controller
          name="username"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="username">Username</FieldLabel>
              <Input
                {...field}
                id="username"
                autoComplete="username"
                autoFocus
                aria-invalid={fieldState.invalid}
                className="h-10"
              />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
        <Controller
          name="password"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <PasswordInput
                {...field}
                id="password"
                autoComplete="current-password"
                aria-invalid={fieldState.invalid}
              />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
        <Button type="submit" className="h-11 text-base" disabled={pending}>
          {pending ? 'Signing in…' : 'Sign in'}
        </Button>
        <div className="flex flex-col gap-1.5 rounded-md border bg-muted px-4 py-3 text-muted-foreground">
          <p>
            New here?{' '}
            <Link
              href={authHref('/sign-up', next)}
              className="font-semibold text-primary underline underline-offset-4 dark:text-accent-foreground"
            >
              Create an account
            </Link>
            . You can use it right away.
          </p>
          <p>Forgot your password? Ask an admin to reset it.</p>
        </div>
      </FieldGroup>
    </form>
  )
}
