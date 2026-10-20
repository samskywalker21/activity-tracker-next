'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { format, parse } from 'date-fns'
import { type ReactElement, useState, useTransition } from 'react'
import { Controller, type FieldPath, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { createHoliday, updateHoliday } from '@/actions/holidays'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { type HolidayInput, holidaySchema } from '@/schemas/reference'

/** `start` and `end` are `yyyy-MM-dd` days. */
type Holiday = { id: number; name: string; start: string; end: string }

// Day strings carry no time zone, so the browser's own midnight is fine for the picker.
const toDate = (day: string) => (day ? parse(day, 'yyyy-MM-dd', new Date()) : undefined)
const toDay = (date: Date) => format(date, 'yyyy-MM-dd')

/** Add (no `holiday`) or edit a holiday. `trigger` opens it. */
export function HolidayDialog({ holiday, trigger }: { holiday?: Holiday; trigger: ReactElement }) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{holiday ? 'Edit holiday' : 'Add holiday'}</DialogTitle>
        </DialogHeader>
        <HolidayForm holiday={holiday} onSaved={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}

function HolidayForm({ holiday, onSaved }: { holiday?: Holiday; onSaved: () => void }) {
  const [error, setError] = useState<string>()
  const [pending, startTransition] = useTransition()
  const form = useForm<HolidayInput>({
    resolver: zodResolver(holidaySchema),
    defaultValues: {
      name: holiday?.name ?? '',
      start: holiday?.start ?? '',
      end: holiday?.end ?? '',
    },
  })
  const [start, end] = form.watch(['start', 'end'])
  const dateError = form.formState.errors.start ?? form.formState.errors.end

  function onSubmit(values: HolidayInput) {
    setError(undefined)
    startTransition(async () => {
      const result = holiday ? await updateHoliday(holiday.id, values) : await createHoliday(values)
      if (result.ok) {
        toast.success(holiday ? 'Holiday saved' : 'Holiday added')
        onSaved()
        return
      }
      setError(result.error)
      for (const [name, messages] of Object.entries(result.fieldErrors ?? {})) {
        if (messages?.[0]) form.setError(name as FieldPath<HolidayInput>, { message: messages[0] })
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
        <Field data-invalid={!!dateError}>
          <FieldLabel>Dates</FieldLabel>
          <FieldDescription>Pick one day, or the first and last day.</FieldDescription>
          <Calendar
            mode="range"
            defaultMonth={toDate(start)}
            selected={{ from: toDate(start), to: toDate(end) }}
            onSelect={(range) => {
              const from = range?.from ? toDay(range.from) : ''
              form.setValue('start', from)
              form.setValue('end', range?.to ? toDay(range.to) : from)
            }}
            className="rounded-md border"
          />
          <FieldError errors={[dateError]} />
        </Field>
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
