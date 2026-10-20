'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { type ReactElement, useState, useTransition } from 'react'
import { Controller, type FieldPath, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import type { z } from 'zod'
import { createDivision, updateDivision } from '@/actions/divisions'
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
import { type DivisionInput, divisionSchema } from '@/schemas/reference'

type Division = { id: number; code: string; name: string }

/** Add (no `division`) or edit a division. `trigger` opens it. */
export function DivisionDialog({
  division,
  trigger,
}: {
  division?: Division
  trigger: ReactElement
}) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{division ? 'Edit division' : 'Add division'}</DialogTitle>
        </DialogHeader>
        <DivisionForm division={division} onSaved={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}

function DivisionForm({ division, onSaved }: { division?: Division; onSaved: () => void }) {
  const [error, setError] = useState<string>()
  const [pending, startTransition] = useTransition()
  const form = useForm<DivisionInput, unknown, z.output<typeof divisionSchema>>({
    resolver: zodResolver(divisionSchema),
    defaultValues: { code: division?.code ?? '', name: division?.name ?? '' },
  })

  function onSubmit(values: z.output<typeof divisionSchema>) {
    setError(undefined)
    startTransition(async () => {
      const result = division
        ? await updateDivision(division.id, values)
        : await createDivision(values)
      if (result.ok) {
        toast.success(division ? 'Division saved' : 'Division added')
        onSaved()
        return
      }
      setError(result.error)
      for (const [name, messages] of Object.entries(result.fieldErrors ?? {})) {
        if (messages?.[0]) form.setError(name as FieldPath<DivisionInput>, { message: messages[0] })
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
