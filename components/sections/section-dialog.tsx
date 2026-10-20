'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { type ReactElement, useState, useTransition } from 'react'
import { Controller, type FieldPath, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import type { z } from 'zod'
import { createSection, updateSection } from '@/actions/sections'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { type SectionInput, sectionSchema } from '@/schemas/reference'

type Section = { id: number; code: string; name: string; divisionId: number }
export type DivisionOption = { id: number; code: string; name: string; isActive: boolean }

/** Add (no `section`) or edit a section. `trigger` opens it. */
export function SectionDialog({
  section,
  divisions,
  trigger,
}: {
  section?: Section
  divisions: DivisionOption[]
  trigger: ReactElement
}) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{section ? 'Edit section' : 'Add section'}</DialogTitle>
        </DialogHeader>
        <SectionForm section={section} divisions={divisions} onSaved={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}

function SectionForm({
  section,
  divisions,
  onSaved,
}: {
  section?: Section
  divisions: DivisionOption[]
  onSaved: () => void
}) {
  const [error, setError] = useState<string>()
  const [pending, startTransition] = useTransition()
  const form = useForm<SectionInput, unknown, z.output<typeof sectionSchema>>({
    resolver: zodResolver(sectionSchema),
    defaultValues: {
      code: section?.code ?? '',
      name: section?.name ?? '',
      divisionId: section?.divisionId,
    },
  })

  // Inactive divisions are offered only when the section is already in one.
  const divisionItems = divisions
    .filter((d) => d.isActive || d.id === section?.divisionId)
    .map((d) => ({ value: d.id, label: `${d.code} – ${d.name}` }))

  function onSubmit(values: z.output<typeof sectionSchema>) {
    setError(undefined)
    startTransition(async () => {
      const result = section ? await updateSection(section.id, values) : await createSection(values)
      if (result.ok) {
        toast.success(section ? 'Section saved' : 'Section added')
        onSaved()
        return
      }
      setError(result.error)
      for (const [name, messages] of Object.entries(result.fieldErrors ?? {})) {
        if (messages?.[0]) form.setError(name as FieldPath<SectionInput>, { message: messages[0] })
      }
    })
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="grid gap-4">
      <FieldGroup>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <Controller
          name="code"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="code">Code</FieldLabel>
              <Input
                {...field}
                id="code"
                autoFocus
                maxLength={10}
                className="uppercase"
                aria-invalid={fieldState.invalid}
              />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
        <Controller
          name="name"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="name">Name</FieldLabel>
              <Input {...field} id="name" aria-invalid={fieldState.invalid} />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
        <Controller
          name="divisionId"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="divisionId">Division</FieldLabel>
              <Select
                items={divisionItems}
                value={field.value ?? null}
                onValueChange={(value) => field.onChange(value ?? undefined)}
              >
                <SelectTrigger id="divisionId" className="w-full" aria-invalid={fieldState.invalid}>
                  <SelectValue placeholder="Choose a division" />
                </SelectTrigger>
                <SelectContent>
                  {divisionItems.map((item) => (
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
      </FieldGroup>
      <DialogFooter>
        <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save'}
        </Button>
      </DialogFooter>
    </form>
  )
}
