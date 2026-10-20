'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { type ComponentProps, useState, useTransition } from 'react'
import { Controller, type FieldPath, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { DialogClose, DialogFooter } from '@/components/ui/dialog'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Role } from '@/generated/prisma/enums'
import type { ActionResult } from '@/lib/action-result'
import { roleLabels } from '@/lib/status'
import { type CreateProfileInput, createProfileSchema } from '@/schemas/profiles'

export type ProfileValues = {
  firstName: string
  middleName: string | null
  lastName: string
  username: string
  position: string
  sectionId: number
}
export type SectionOption = { id: number; code: string; name: string; isActive: boolean }

// Editing shows no password or role field, so their checks are dropped. The edit actions validate
// with `profileSchema`, which ignores both.
const editSchema = createProfileSchema.extend({ password: z.string(), role: z.enum(Role) })

const roleItems = Object.values(Role).map((role) => ({
  value: role,
  label: roleLabels[role],
}))

/**
 * The profile fields, shared by the admin dialogs and the user's own profile page. Without a
 * `profile` it is the admin "create" form, which also asks for a password and a role.
 */
export function ProfileForm({
  profile,
  sections,
  action,
  onSaved,
  inDialog = false,
}: {
  profile?: ProfileValues
  sections: SectionOption[]
  action: (values: CreateProfileInput) => Promise<ActionResult>
  onSaved?: () => void
  inDialog?: boolean
}) {
  const creating = !profile
  const [error, setError] = useState<string>()
  const [pending, startTransition] = useTransition()
  const form = useForm<CreateProfileInput>({
    resolver: zodResolver(creating ? createProfileSchema : editSchema),
    defaultValues: {
      firstName: profile?.firstName ?? '',
      middleName: profile?.middleName ?? '',
      lastName: profile?.lastName ?? '',
      username: profile?.username ?? '',
      position: profile?.position ?? '',
      sectionId: profile?.sectionId,
      password: '',
      role: 'STAFF',
    },
  })

  // Inactive sections are offered only when the profile is already in one.
  const sectionItems = sections
    .filter((s) => s.isActive || s.id === profile?.sectionId)
    .map((s) => ({ value: s.id, label: `${s.code} – ${s.name}` }))

  function onSubmit(values: CreateProfileInput) {
    setError(undefined)
    startTransition(async () => {
      const result = await action(values)
      if (result.ok) {
        toast.success(creating ? 'Profile created' : 'Profile saved')
        onSaved?.()
        return
      }
      setError(result.error)
      for (const [name, messages] of Object.entries(result.fieldErrors ?? {})) {
        if (messages?.[0]) {
          form.setError(name as FieldPath<CreateProfileInput>, { message: messages[0] })
        }
      }
    })
  }

  function textField(
    name: 'firstName' | 'middleName' | 'lastName' | 'username' | 'position' | 'password',
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

  const submit = (
    <Button type="submit" disabled={pending}>
      {pending ? 'Saving…' : creating ? 'Create profile' : 'Save'}
    </Button>
  )

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="grid gap-4">
      <FieldGroup>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          {textField('firstName', 'First name', { autoComplete: 'given-name' })}
          {textField('lastName', 'Last name', { autoComplete: 'family-name' })}
        </div>
        {textField('middleName', 'Middle name (optional)', { autoComplete: 'additional-name' })}
        <div className="grid gap-4 sm:grid-cols-2">
          {textField('username', 'Username', { autoComplete: 'off' })}
          {textField('position', 'Position')}
        </div>
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
                <SelectTrigger id="sectionId" className="w-full" aria-invalid={fieldState.invalid}>
                  <SelectValue placeholder="Choose a section" />
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
        {creating && (
          <div className="grid gap-4 sm:grid-cols-2">
            {textField('password', 'Password', { type: 'password', autoComplete: 'new-password' })}
            <Controller
              name="role"
              control={form.control}
              render={({ field }) => (
                <Field>
                  <FieldLabel htmlFor="role">Role</FieldLabel>
                  <Select items={roleItems} value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="role" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {roleItems.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
            />
          </div>
        )}
      </FieldGroup>
      {inDialog ? (
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          {submit}
        </DialogFooter>
      ) : (
        <div className="flex justify-end">{submit}</div>
      )}
    </form>
  )
}
