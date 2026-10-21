'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import Link from 'next/link'
import { type ComponentProps, useState, useTransition } from 'react'
import { Controller, type FieldPath, useForm } from 'react-hook-form'
import { signUp } from '@/actions/auth'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { type SignUpInput, signUpSchema } from '@/schemas/auth'

type Section = { id: number; code: string; name: string }

export function SignUpForm({ sections }: { sections: Section[] }) {
  const [error, setError] = useState<string>()
  const [pending, startTransition] = useTransition()
  const form = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      firstName: '',
      middleName: '',
      lastName: '',
      position: '',
      username: '',
      password: '',
      confirmPassword: '',
    },
  })

  function onSubmit(values: SignUpInput) {
    setError(undefined)
    startTransition(async () => {
      // On success the action redirects, so a result only ever means failure.
      const result = await signUp(values)
      if (result.ok) return
      setError(result.error)
      for (const [name, messages] of Object.entries(result.fieldErrors ?? {})) {
        if (messages?.[0]) form.setError(name as FieldPath<SignUpInput>, { message: messages[0] })
      }
    })
  }

  function textField(
    name: Exclude<FieldPath<SignUpInput>, 'sectionId'>,
    label: string,
    props: ComponentProps<typeof Input> = {}
  ) {
    return (
      <Controller
        name={name}
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={name}>{label}</FieldLabel>
            <Input {...field} {...props} id={name} aria-invalid={fieldState.invalid} />
            <FieldError errors={[fieldState.error]} />
          </Field>
        )}
      />
    )
  }

  const sectionItems = sections.map((s) => ({ value: s.id, label: `${s.code} – ${s.name}` }))

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>
          <h1>Create an account</h1>
        </CardTitle>
        <CardDescription>Your account can be used right away.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {textField('firstName', 'First name', { autoComplete: 'given-name', autoFocus: true })}
            {textField('middleName', 'Middle name (optional)', { autoComplete: 'additional-name' })}
            {textField('lastName', 'Last name', { autoComplete: 'family-name' })}
            {textField('position', 'Position', { autoComplete: 'organization-title' })}
            <Controller
              name="sectionId"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="sectionId">Section</FieldLabel>
                  <Select
                    items={sectionItems}
                    value={field.value ?? null}
                    onValueChange={(value) => field.onChange(value ?? undefined)}
                  >
                    <SelectTrigger
                      id="sectionId"
                      className="w-full"
                      aria-invalid={fieldState.invalid}
                    >
                      <SelectValue placeholder="Choose your section" />
                    </SelectTrigger>
                    <SelectContent>
                      {sectionItems.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            {textField('username', 'Username', { autoComplete: 'username' })}
            {textField('password', 'Password', { type: 'password', autoComplete: 'new-password' })}
            {textField('confirmPassword', 'Confirm password', {
              type: 'password',
              autoComplete: 'new-password',
            })}
            <Button type="submit" disabled={pending}>
              {pending ? 'Creating account…' : 'Create account'}
            </Button>
            <p className="text-center text-muted-foreground text-sm">
              Already have an account?{' '}
              <Link href="/sign-in" className="text-foreground underline underline-offset-4">
                Sign in
              </Link>
            </p>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
