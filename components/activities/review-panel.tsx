'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { cn } from 'cn'
import { Check, Undo2, X } from 'lucide-react'
import { useState, useTransition } from 'react'
import { Controller, type FieldPath, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { changeStatus } from '@/actions/activities'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import type { REVIEW_DECISIONS } from '@/lib/rules'
import { type StatusChangeInput, statusChangeSchema } from '@/schemas/activities'

type Decision = (typeof REVIEW_DECISIONS)[number]

const toasts: Record<Decision, string> = {
  APPROVED: 'Approved',
  RETURNED: 'Returned for changes',
  REJECTED: 'Rejected',
}

/** Approve, return or reject a pending activity, with one note for whichever is chosen. */
export function ReviewPanel({
  id,
  description,
  className,
}: {
  id: number
  description: string
  className?: string
}) {
  const [error, setError] = useState<string>()
  const [pending, startTransition] = useTransition()
  const form = useForm<StatusChangeInput>({
    resolver: zodResolver(statusChangeSchema),
    defaultValues: { status: 'APPROVED', note: '' },
  })

  function decide(status: Decision) {
    form.setValue('status', status)
    form.handleSubmit((values) => {
      setError(undefined)
      startTransition(async () => {
        const result = await changeStatus(id, values)
        if (result.ok) {
          toast.success(toasts[status])
          return
        }
        setError(result.error)
        for (const [name, messages] of Object.entries(result.fieldErrors ?? {})) {
          if (messages?.[0]) {
            form.setError(name as FieldPath<StatusChangeInput>, { message: messages[0] })
          }
        }
      })
    })()
  }

  return (
    <Card className={cn('border-t-4 border-t-status-pending', className)}>
      <CardHeader>
        <CardTitle>
          <h2 className="font-bold text-lg">Waiting for your review</h2>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
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
              <FieldLabel htmlFor="review-note">
                Note
                <span className="font-normal text-muted-foreground">
                  (needed to return or reject)
                </span>
              </FieldLabel>
              <Textarea {...field} id="review-note" rows={3} aria-invalid={fieldState.invalid} />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
        <div className="flex flex-wrap gap-2 *:flex-1">
          <Button disabled={pending} onClick={() => decide('APPROVED')}>
            <Check /> Approve
          </Button>
          <Button variant="outline" disabled={pending} onClick={() => decide('RETURNED')}>
            <Undo2 /> Return
          </Button>
          <Button variant="destructive" disabled={pending} onClick={() => decide('REJECTED')}>
            <X /> Reject
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
