'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useState, useTransition } from 'react'
import { Controller, type FieldPath, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { changeStatus } from '@/actions/activities'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { type StatusChangeInput, statusChangeSchema } from '@/schemas/activities'

/** Cancels the activity, with the reason `canCancel` requires. */
export function CancelDialog({ id }: { id: number }) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string>()
  const [pending, startTransition] = useTransition()
  const form = useForm<StatusChangeInput>({
    resolver: zodResolver(statusChangeSchema),
    defaultValues: { status: 'CANCELLED', note: '' },
  })

  function onSubmit(values: StatusChangeInput) {
    setError(undefined)
    startTransition(async () => {
      const result = await changeStatus(id, values)
      if (result.ok) {
        toast.success('Activity cancelled')
        setOpen(false)
        form.reset()
        return
      }
      setError(result.error)
      for (const [name, messages] of Object.entries(result.fieldErrors ?? {})) {
        if (messages?.[0]) {
          form.setError(name as FieldPath<StatusChangeInput>, { message: messages[0] })
        }
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="destructive" />}>Cancel activity</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel this activity?</DialogTitle>
          <DialogDescription>It can no longer be edited or reviewed afterwards.</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="grid gap-4">
          <FieldGroup>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Controller
              name="note"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="cancel-note">Reason</FieldLabel>
                  <Textarea
                    {...field}
                    id="cancel-note"
                    rows={4}
                    aria-invalid={fieldState.invalid}
                  />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
          </FieldGroup>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Keep it</DialogClose>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? 'Saving…' : 'Cancel the activity'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
