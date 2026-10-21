'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import Link from 'next/link'
import { type ComponentProps, type ReactNode, useState, useTransition } from 'react'
import { Controller, type FieldPath, useForm } from 'react-hook-form'
import { signUp } from '@/actions/auth'
import { PasswordInput } from '@/components/auth/password-input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  ComboboxTrigger,
} from '@/components/ui/combobox'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { InputGroupAddon, InputGroupButton } from '@/components/ui/input-group'
import { authHref } from '@/lib/next-path'
import { type SignUpInput, signUpSchema } from '@/schemas/auth'

// Sections arrive ordered by division, then name.
type Section = { id: number; code: string; name: string; division: { name: string } }
type SectionItem = { value: number; label: string; code: string; name: string }
type SectionGroup = { value: string; items: SectionItem[] }

const legendClass = 'mb-3 font-bold text-muted-foreground text-xs uppercase tracking-wider'

export function SignUpForm({ sections, next }: { sections: Section[]; next: string }) {
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
      const result = await signUp(values, next)
      if (result.ok) return
      setError(result.error)
      for (const [name, messages] of Object.entries(result.fieldErrors ?? {})) {
        if (messages?.[0]) form.setError(name as FieldPath<SignUpInput>, { message: messages[0] })
      }
    })
  }

  function textField(
    name: Exclude<FieldPath<SignUpInput>, 'sectionId'>,
    label: ReactNode,
    props: ComponentProps<typeof Input> = {},
    hint?: string
  ) {
    const Control = props.type === 'password' ? PasswordInput : Input
    return (
      <Controller
        name={name}
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={name}>{label}</FieldLabel>
            <Control
              {...field}
              {...props}
              id={name}
              aria-invalid={fieldState.invalid}
              aria-describedby={hint && `${name}-hint`}
              className="h-10"
            />
            {hint && <FieldDescription id={`${name}-hint`}>{hint}</FieldDescription>}
            <FieldError errors={[fieldState.error]} />
          </Field>
        )}
      />
    )
  }

  const sectionItems: SectionItem[] = []
  const sectionGroups: SectionGroup[] = []
  for (const section of sections) {
    const item = {
      value: section.id,
      label: `${section.code} – ${section.name}`,
      code: section.code,
      name: section.name,
    }
    sectionItems.push(item)
    const group = sectionGroups.at(-1)
    if (group?.value === section.division.name) group.items.push(item)
    else sectionGroups.push({ value: section.division.name, items: [item] })
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="w-full max-w-2xl">
      <FieldGroup className="gap-8">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-bold text-3xl">Create an account</h1>
          <p className="text-base text-muted-foreground">
            For CHD Northern Mindanao staff. You can use your account right away.
          </p>
        </div>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <FieldSet>
          <FieldLegend className={legendClass}>About you</FieldLegend>
          <div className="grid gap-5 sm:grid-cols-3 sm:gap-3">
            {textField('firstName', 'First name', { autoComplete: 'given-name', autoFocus: true })}
            {textField(
              'middleName',
              <>
                Middle name <span className="font-normal text-muted-foreground">(optional)</span>
              </>,
              { autoComplete: 'additional-name' }
            )}
            {textField('lastName', 'Last name', { autoComplete: 'family-name' })}
          </div>
        </FieldSet>
        <FieldSet>
          <FieldLegend className={legendClass}>Your work</FieldLegend>
          <div className="grid gap-5 sm:grid-cols-2 sm:gap-3">
            {textField('position', 'Position', {
              autoComplete: 'organization-title',
              placeholder: 'e.g. Nurse II',
            })}
            <Controller
              name="sectionId"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="sectionId">Section</FieldLabel>
                  <Combobox
                    autoHighlight
                    items={sectionGroups}
                    value={sectionItems.find((item) => item.value === field.value) ?? null}
                    onValueChange={(item: SectionItem | null) => field.onChange(item?.value)}
                  >
                    <ComboboxInput
                      id="sectionId"
                      placeholder="Search or choose your section"
                      aria-invalid={fieldState.invalid}
                      className="h-10 w-full"
                      // shadcn's built-in trigger has no accessible name; this one is labelled.
                      showTrigger={false}
                    >
                      <InputGroupAddon align="inline-end">
                        <InputGroupButton
                          size="icon-xs"
                          aria-label="Show all sections"
                          render={<ComboboxTrigger />}
                        />
                      </InputGroupAddon>
                    </ComboboxInput>
                    <ComboboxContent>
                      <ComboboxEmpty>No sections match.</ComboboxEmpty>
                      <ComboboxList>
                        {(group: SectionGroup) => (
                          <ComboboxGroup key={group.value} items={group.items}>
                            <ComboboxLabel className="font-semibold">{group.value}</ComboboxLabel>
                            <ComboboxCollection>
                              {(item: SectionItem) => (
                                <ComboboxItem key={item.value} value={item}>
                                  <span className="w-14 shrink-0 font-semibold">{item.code}</span>
                                  {item.name}
                                </ComboboxItem>
                              )}
                            </ComboboxCollection>
                          </ComboboxGroup>
                        )}
                      </ComboboxList>
                    </ComboboxContent>
                  </Combobox>
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
          </div>
        </FieldSet>
        <FieldSet>
          <FieldLegend className={legendClass}>Account</FieldLegend>
          <FieldGroup>
            {textField(
              'username',
              'Username',
              { autoComplete: 'username' },
              'At least 4 characters: letters, numbers, dots and underscores.'
            )}
            <div className="grid gap-5 sm:grid-cols-2 sm:gap-3">
              {textField(
                'password',
                'Password',
                { type: 'password', autoComplete: 'new-password' },
                'At least 4 characters.'
              )}
              {textField('confirmPassword', 'Confirm password', {
                type: 'password',
                autoComplete: 'new-password',
              })}
            </div>
          </FieldGroup>
        </FieldSet>
        <div className="flex flex-col gap-4">
          <Button type="submit" className="h-11 text-base" disabled={pending}>
            {pending ? 'Creating account…' : 'Create account'}
          </Button>
          <p className="rounded-md border bg-muted px-4 py-3 text-muted-foreground">
            Already have an account?{' '}
            <Link
              href={authHref('/sign-in', next)}
              className="font-semibold text-primary underline underline-offset-4 dark:text-accent-foreground"
            >
              Sign in
            </Link>
          </p>
        </div>
      </FieldGroup>
    </form>
  )
}
