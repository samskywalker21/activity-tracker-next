'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useState, useTransition } from 'react'
import { Controller, type FieldPath, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { changeStatus } from '@/actions/activities'
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import type { ActivityStatus } from '@/generated/prisma/enums'
import { NOTE_REQUIRED } from '@/lib/rules'
import { type StatusChangeInput, statusChangeSchema } from '@/schemas/activities'

const decisionLabels: Partial<Record<ActivityStatus, string>> = {
  APPROVED: 'Approve',
  RETURNED: 'Return for changes',
  REJECTED: 'Reject',
  CANCELLED: 'Cancel the activity',
}

/** Approve, return, reject or cancel; `allowed` comes from `allowedTransitions`. */
export function StatusDialog({ id, allowed }: { id: number; allowed: ActivityStatus[] }) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string>()
  const [pending, startTransition] = useTransition()
  const form = useForm<StatusChangeInput>({
    resolver: zodResolver(statusChangeSchema),
    defaultValues: { status: allowed[0] as StatusChangeInput['status'], note: '' },
  })
  const status = useWatch({ control: form.control, name: 'status' })

  function onSubmit(values: StatusChangeInput) {
    setError(undefined)
    startTransition(async () => {
      const result = await changeStatus(id, values)
      if (result.ok) {
        toast.success('Status changed')
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
      <DialogTrigger render={<Button variant="outline" />}>Change status</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change status</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="grid gap-4">
          <FieldGroup>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Controller
              name="status"
              control={form.control}
              render={({ field }) => (
                <RadioGroup value={field.value} onValueChange={field.onChange}>
                  {allowed.map((value) => (
                    <Field key={value} orientation="horizontal">
                      <RadioGroupItem id={`status-${value}`} value={value} />
                      <FieldLabel htmlFor={`status-${value}`}>{decisionLabels[value]}</FieldLabel>
                    </Field>
                  ))}
                </RadioGroup>
              )}
            />
            <Controller
              name="note"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="note">
                    {NOTE_REQUIRED.includes(status) ? 'Reason' : 'Note (optional)'}
                  </FieldLabel>
                  <Textarea {...field} id="note" rows={4} aria-invalid={fieldState.invalid} />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
          </FieldGroup>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Close</DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : decisionLabels[status]}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
