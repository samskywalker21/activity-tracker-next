'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useState, useTransition } from 'react'
import { Controller, type FieldPath, useForm } from 'react-hook-form'
import { changeOwnPassword } from '@/actions/profiles'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { type ChangeOwnPasswordInput, changeOwnPasswordSchema } from '@/schemas/profiles'

export function ChangePasswordForm() {
  const [error, setError] = useState<string>()
  const [pending, startTransition] = useTransition()
  const form = useForm<ChangeOwnPasswordInput>({
    resolver: zodResolver(changeOwnPasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  })

  function onSubmit(values: ChangeOwnPasswordInput) {
    setError(undefined)
    startTransition(async () => {
      // On success the action signs out and redirects, so a result only ever means failure.
      const result = await changeOwnPassword(values)
      if (result.ok) return
      setError(result.error)
      for (const [name, messages] of Object.entries(result.fieldErrors ?? {})) {
        if (messages?.[0]) {
          form.setError(name as FieldPath<ChangeOwnPasswordInput>, { message: messages[0] })
        }
      }
    })
  }

  function passwordField(
    name: FieldPath<ChangeOwnPasswordInput>,
    label: string,
    autoComplete: string
  ) {
    return (
      <Controller
        name={name}
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={name}>{label}</FieldLabel>
            <Input
              {...field}
              id={name}
              type="password"
              autoComplete={autoComplete}
              aria-invalid={fieldState.invalid}
            />
            <FieldError errors={[fieldState.error]} />
          </Field>
        )}
      />
    )
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="grid gap-4">
      <FieldGroup>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {passwordField('currentPassword', 'Current password', 'current-password')}
        <div className="grid gap-4 sm:grid-cols-2">
          {passwordField('newPassword', 'New password', 'new-password')}
          {passwordField('confirmPassword', 'Confirm new password', 'new-password')}
        </div>
      </FieldGroup>
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? 'Changing…' : 'Change password'}
        </Button>
      </div>
    </form>
  )
}
