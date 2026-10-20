'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { type ReactElement, useState, useTransition } from 'react'
import { Controller, type FieldPath, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { createParticipant, updateParticipant } from '@/actions/participants'
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { type ParticipantInput, participantSchema } from '@/schemas/reference'

type Participant = { id: number; name: string; isInternal: boolean }

/** Add (no `participant`) or edit a participant. `trigger` opens it. */
export function ParticipantDialog({
  participant,
  trigger,
}: {
  participant?: Participant
  trigger: ReactElement
}) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{participant ? 'Edit participant' : 'Add participant'}</DialogTitle>
        </DialogHeader>
        <ParticipantForm participant={participant} onSaved={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}

function ParticipantForm({
  participant,
  onSaved,
}: {
  participant?: Participant
  onSaved: () => void
}) {
  const [error, setError] = useState<string>()
  const [pending, startTransition] = useTransition()
  const form = useForm<ParticipantInput>({
    resolver: zodResolver(participantSchema),
    defaultValues: { name: participant?.name ?? '', isInternal: participant?.isInternal ?? true },
  })

  function onSubmit(values: ParticipantInput) {
    setError(undefined)
    startTransition(async () => {
      const result = participant
        ? await updateParticipant(participant.id, values)
        : await createParticipant(values)
      if (result.ok) {
        toast.success(participant ? 'Participant saved' : 'Participant added')
        onSaved()
        return
      }
      setError(result.error)
      for (const [name, messages] of Object.entries(result.fieldErrors ?? {})) {
        if (messages?.[0]) {
          form.setError(name as FieldPath<ParticipantInput>, { message: messages[0] })
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
        <Controller
          name="isInternal"
          control={form.control}
          render={({ field }) => (
            <Field>
              <FieldLabel>Type</FieldLabel>
              <RadioGroup
                value={field.value ? 'internal' : 'external'}
                onValueChange={(value) => field.onChange(value === 'internal')}
                className="flex gap-6"
              >
                <FieldLabel className="font-normal">
                  <RadioGroupItem value="internal" />
                  Internal (DOH)
                </FieldLabel>
                <FieldLabel className="font-normal">
                  <RadioGroupItem value="external" />
                  External
                </FieldLabel>
              </RadioGroup>
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
