'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { LoaderCircle, TriangleAlert } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { type ComponentProps, type ReactNode, useEffect, useState, useTransition } from 'react'
import {
  type Control,
  Controller,
  type DefaultValues,
  type FieldPath,
  useForm,
  useWatch,
} from 'react-hook-form'
import { toast } from 'sonner'
import { checkConflicts, createActivity, updateActivity } from '@/actions/activities'
import { ConflictList } from '@/components/activities/conflict-list'
import { DatePicker } from '@/components/date-picker'
import { MultiSelect } from '@/components/multi-select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { ActivityType } from '@/generated/prisma/enums'
import { type GroupedConflicts, groupConflicts } from '@/lib/conflicts'
import { typeLabels } from '@/lib/status'
import { type ActivityInput, activitySchema } from '@/schemas/activities'

type Option<V> = { value: V; label: string }
export type ActivityFormOptions = {
  sections: Option<number>[]
  participants: Option<number>[]
  lgus: Option<string>[]
  facilities: Option<number>[]
}

const typeItems = Object.values(ActivityType).map((type) => ({
  value: type,
  label: typeLabels[type],
}))

/**
 * Create (no `id`) or edit an activity. `notice` is shown above the form, e.g. that saving sends
 * an approved activity back for review.
 */
export function ActivityForm({
  id,
  defaultValues,
  options,
  notice,
}: {
  id?: number
  defaultValues: DefaultValues<ActivityInput>
  options: ActivityFormOptions
  notice?: string
}) {
  const router = useRouter()
  const [error, setError] = useState<string>()
  const [confirming, setConfirming] = useState(false)
  const [pending, startTransition] = useTransition()
  const form = useForm<ActivityInput>({ resolver: zodResolver(activitySchema), defaultValues })
  const allDay = useWatch({ control: form.control, name: 'allDay' })
  const { grouped, checking } = useConflicts(id, form.control)

  function save(values: ActivityInput) {
    setError(undefined)
    setConfirming(false)
    startTransition(async () => {
      const result = id ? await updateActivity(id, values) : await createActivity(values)
      if (result.ok) {
        toast.success(id ? 'Activity saved' : 'Activity submitted for review')
        router.push(`/activities/${id ?? result.data?.id}`)
        return
      }
      setError(result.error)
      for (const [name, messages] of Object.entries(result.fieldErrors ?? {})) {
        if (messages?.[0]) form.setError(name as FieldPath<ActivityInput>, { message: messages[0] })
      }
    })
  }

  // A warning, never a block: ask once when the check found anything.
  const onSubmit = (values: ActivityInput) => (grouped?.total ? setConfirming(true) : save(values))

  function textField(
    name: 'title' | 'owner' | 'venue' | 'prNo',
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

  function overflowField(
    name: 'otherParticipants' | 'otherLgu' | 'otherFacilities' | 'remarks',
    label: string
  ) {
    return (
      <Controller
        name={name}
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={name}>{label}</FieldLabel>
            <Textarea {...field} id={name} rows={2} aria-invalid={fieldState.invalid} />
            <FieldError errors={[fieldState.error]} />
          </Field>
        )}
      />
    )
  }

  function pickerField<V extends string | number>(
    name: 'participantIds' | 'lguIds' | 'facilityIds',
    label: string,
    items: Option<V>[]
  ) {
    return (
      <Controller
        name={name}
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={name}>{label}</FieldLabel>
            <MultiSelect
              id={name}
              items={items}
              value={field.value as V[]}
              onChange={field.onChange}
              placeholder="Search…"
              invalid={fieldState.invalid}
            />
            <FieldError errors={[fieldState.error]} />
          </Field>
        )}
      />
    )
  }

  function whenField(edge: 'start' | 'end', label: string) {
    const date = edge === 'start' ? 'startDate' : 'endDate'
    const time = edge === 'start' ? 'startTime' : 'endTime'
    return (
      <Field data-invalid={!!form.formState.errors[date]}>
        <FieldLabel htmlFor={date}>{label}</FieldLabel>
        <div className="flex gap-2">
          <Controller
            name={date}
            control={form.control}
            render={({ field, fieldState }) => (
              <DatePicker
                id={date}
                value={field.value}
                onChange={field.onChange}
                invalid={fieldState.invalid}
              />
            )}
          />
          {!allDay && (
            <Controller
              name={time}
              control={form.control}
              render={({ field, fieldState }) => (
                <Input
                  {...field}
                  type="time"
                  aria-label={`${label} time`}
                  className="w-32 shrink-0"
                  aria-invalid={fieldState.invalid}
                />
              )}
            />
          )}
        </div>
        <FieldError errors={[form.formState.errors[date], form.formState.errors[time]]} />
      </Field>
    )
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      noValidate
      className="grid items-start gap-6 lg:grid-cols-[1fr_20rem]"
    >
      <div className="grid gap-6">
        {notice && (
          <Alert>
            <TriangleAlert />
            <AlertDescription>{notice}</AlertDescription>
          </Alert>
        )}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <FormCard title="Details">
          {textField('title', 'Title', { autoFocus: !id })}
          <div className="grid gap-4 sm:grid-cols-2">
            <Controller
              name="type"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid} className="min-w-0">
                  <FieldLabel htmlFor="type">Type</FieldLabel>
                  <Select
                    items={typeItems}
                    value={field.value ?? null}
                    onValueChange={(value) => field.onChange(value ?? undefined)}
                  >
                    <SelectTrigger id="type" className="w-full" aria-invalid={fieldState.invalid}>
                      <SelectValue placeholder="Choose a type" />
                    </SelectTrigger>
                    <SelectContent>
                      {typeItems.map((item) => (
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
            <Controller
              name="sectionId"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid} className="min-w-0">
                  <FieldLabel htmlFor="sectionId">Section</FieldLabel>
                  <Select
                    items={options.sections}
                    value={field.value ?? null}
                    onValueChange={(value) => field.onChange(value ?? undefined)}
                  >
                    <SelectTrigger
                      id="sectionId"
                      className="w-full"
                      aria-invalid={fieldState.invalid}
                    >
                      <SelectValue placeholder="Choose a section" />
                    </SelectTrigger>
                    <SelectContent>
                      {options.sections.map((item) => (
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
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {textField('owner', 'Owner')}
            {textField('prNo', 'PR number (optional)')}
          </div>
          <Controller
            name="virtual"
            control={form.control}
            render={({ field }) => (
              <Field orientation="horizontal">
                <Switch id="virtual" checked={field.value} onCheckedChange={field.onChange} />
                <FieldLabel htmlFor="virtual">Held online</FieldLabel>
              </Field>
            )}
          />
          {overflowField('remarks', 'Remarks (optional)')}
        </FormCard>

        <FormCard title="Schedule">
          <Controller
            name="allDay"
            control={form.control}
            render={({ field }) => (
              <Field orientation="horizontal">
                <Switch id="allDay" checked={field.value} onCheckedChange={field.onChange} />
                <div className="grid gap-1">
                  <FieldLabel htmlFor="allDay">All day</FieldLabel>
                  <FieldDescription>Covers whole days; the times are ignored.</FieldDescription>
                </div>
              </Field>
            )}
          />
          {/* A date and a time do not fit in half a row; two dates alone do. */}
          <div className={allDay ? 'grid gap-4 sm:grid-cols-2' : 'grid gap-4'}>
            {whenField('start', 'Start')}
            {whenField('end', 'End')}
          </div>
          {textField('venue', 'Venue')}
        </FormCard>

        <FormCard title="Participants and places">
          {pickerField('participantIds', 'Participants', options.participants)}
          {overflowField('otherParticipants', 'Other participants (optional)')}
          {pickerField('lguIds', 'LGUs', options.lgus)}
          {overflowField('otherLgu', 'Other LGUs (optional)')}
          {pickerField('facilityIds', 'Facilities', options.facilities)}
          {overflowField('otherFacilities', 'Other facilities (optional)')}
        </FormCard>
      </div>

      <aside className="grid gap-4 lg:sticky lg:top-20">
        <Card size="sm">
          <CardHeader>
            <CardTitle>Conflicts</CardTitle>
          </CardHeader>
          <CardContent>
            {checking ? (
              <p className="flex items-center gap-2 text-muted-foreground text-sm">
                <LoaderCircle className="size-4 animate-spin" /> Checking…
              </p>
            ) : !grouped ? (
              <p className="text-muted-foreground text-sm">
                Pick the dates to check for conflicts.
              </p>
            ) : grouped.total === 0 ? (
              <p className="text-muted-foreground text-sm">Nothing else is scheduled then.</p>
            ) : (
              <ConflictList grouped={grouped} />
            )}
          </CardContent>
        </Card>
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="flex-1" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1" disabled={pending}>
            {pending ? 'Saving…' : id ? 'Save' : 'Submit'}
          </Button>
        </div>
      </aside>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save despite the conflicts?</AlertDialogTitle>
            <AlertDialogDescription>
              Other activities or holidays fall on these dates.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {grouped && (
            <div className="max-h-72 overflow-y-auto">
              <ConflictList grouped={grouped} />
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Go back</AlertDialogCancel>
            <Button onClick={form.handleSubmit(save)}>Save anyway</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  )
}

function FormCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <FieldGroup>{children}</FieldGroup>
      </CardContent>
    </Card>
  )
}

/**
 * The live conflict check: asks the server half a second after the dates or selections stop
 * changing, once both dates are set. The result of a superseded check is dropped.
 */
function useConflicts(id: number | undefined, control: Control<ActivityInput>) {
  const watched = useWatch({
    control,
    name: [
      'allDay',
      'startDate',
      'startTime',
      'endDate',
      'endTime',
      'participantIds',
      'lguIds',
      'facilityIds',
    ],
  })
  const [grouped, setGrouped] = useState<GroupedConflicts | null>(null)
  const [checking, setChecking] = useState(false)
  // The watched array is a new object on every render; compare by content.
  const key = JSON.stringify(watched)

  useEffect(() => {
    const [allDay, startDate, startTime, endDate, endTime, participantIds, lguIds, facilityIds] =
      JSON.parse(key) as typeof watched
    if (!startDate || !endDate) {
      setGrouped(null)
      return
    }
    let current = true
    const timer = setTimeout(async () => {
      setChecking(true)
      const result = await checkConflicts({
        id,
        allDay,
        startDate,
        startTime,
        endDate,
        endTime,
        participantIds,
        lguIds,
        facilityIds,
      })
      if (!current) return
      setGrouped(result.ok ? groupConflicts(result.data) : null)
      setChecking(false)
    }, 500)
    return () => {
      current = false
      clearTimeout(timer)
    }
  }, [id, key])

  return { grouped, checking }
}
