'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { type ReactElement, useState, useTransition } from 'react'
import { Controller, type FieldPath, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { createLgu, updateLgu } from '@/actions/lgus'
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
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { type LguInput, lguSchema } from '@/schemas/reference'

type Lgu = { id: string; muncity: string; provinceId: number }
export type ProvinceOption = { id: number; name: string }

/** Add (no `lgu`) or edit an LGU. `trigger` opens it. */
export function LguDialog({
  lgu,
  provinces,
  trigger,
}: {
  lgu?: Lgu
  provinces: ProvinceOption[]
  trigger: ReactElement
}) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{lgu ? 'Edit LGU' : 'Add LGU'}</DialogTitle>
        </DialogHeader>
        <LguForm lgu={lgu} provinces={provinces} onSaved={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}

function LguForm({
  lgu,
  provinces,
  onSaved,
}: {
  lgu?: Lgu
  provinces: ProvinceOption[]
  onSaved: () => void
}) {
  const [error, setError] = useState<string>()
  const [pending, startTransition] = useTransition()
  const form = useForm<LguInput>({
    resolver: zodResolver(lguSchema),
    defaultValues: { id: lgu?.id ?? '', muncity: lgu?.muncity ?? '', provinceId: lgu?.provinceId },
  })
  const provinceItems = provinces.map((p) => ({ value: p.id, label: p.name }))

  function onSubmit(values: LguInput) {
    setError(undefined)
    startTransition(async () => {
      const result = lgu ? await updateLgu(lgu.id, values) : await createLgu(values)
      if (result.ok) {
        toast.success(lgu ? 'LGU saved' : 'LGU added')
        onSaved()
        return
      }
      setError(result.error)
      for (const [name, messages] of Object.entries(result.fieldErrors ?? {})) {
        if (messages?.[0]) form.setError(name as FieldPath<LguInput>, { message: messages[0] })
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
          name="id"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="id">PSGC code</FieldLabel>
              <Input
                {...field}
                id="id"
                inputMode="numeric"
                maxLength={9}
                autoFocus={!lgu}
                disabled={!!lgu}
                aria-invalid={fieldState.invalid}
              />
              {lgu && (
                <FieldDescription>The code identifies the LGU and cannot change.</FieldDescription>
              )}
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
        <Controller
          name="muncity"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="muncity">Municipality or city</FieldLabel>
              <Input {...field} id="muncity" autoFocus={!!lgu} aria-invalid={fieldState.invalid} />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
        <Controller
          name="provinceId"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="provinceId">Province</FieldLabel>
              <Select
                items={provinceItems}
                value={field.value ?? null}
                onValueChange={(value) => field.onChange(value ?? undefined)}
              >
                <SelectTrigger id="provinceId" className="w-full" aria-invalid={fieldState.invalid}>
                  <SelectValue placeholder="Choose a province" />
                </SelectTrigger>
                <SelectContent>
                  {provinceItems.map((item) => (
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
