'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { type ReactElement, useState, useTransition } from 'react'
import { Controller, type FieldPath, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { createFacility, updateFacility } from '@/actions/facilities'
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
import { type FacilityInput, facilitySchema } from '@/schemas/reference'

type Facility = { id: number; name: string }

/** Add (no `facility`) or edit a facility. `trigger` opens it. */
export function FacilityDialog({
  facility,
  trigger,
}: {
  facility?: Facility
  trigger: ReactElement
}) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{facility ? 'Edit facility' : 'Add facility'}</DialogTitle>
        </DialogHeader>
        <FacilityForm facility={facility} onSaved={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}

function FacilityForm({ facility, onSaved }: { facility?: Facility; onSaved: () => void }) {
  const [error, setError] = useState<string>()
  const [pending, startTransition] = useTransition()
  const form = useForm<FacilityInput>({
    resolver: zodResolver(facilitySchema),
    defaultValues: { name: facility?.name ?? '' },
  })

  function onSubmit(values: FacilityInput) {
    setError(undefined)
    startTransition(async () => {
      const result = facility
        ? await updateFacility(facility.id, values)
        : await createFacility(values)
      if (result.ok) {
        toast.success(facility ? 'Facility saved' : 'Facility added')
        onSaved()
        return
      }
      setError(result.error)
      for (const [name, messages] of Object.entries(result.fieldErrors ?? {})) {
        if (messages?.[0]) {
          form.setError(name as FieldPath<FacilityInput>, { message: messages[0] })
        }
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
          name="name"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="name">Name</FieldLabel>
              <Input {...field} id="name" autoFocus aria-invalid={fieldState.invalid} />
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
