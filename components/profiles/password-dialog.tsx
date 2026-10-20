'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useState, useTransition } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { setPassword } from '@/actions/profiles'
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
import { Input } from '@/components/ui/input'
import { type SetPasswordInput, setPasswordSchema } from '@/schemas/profiles'

/** Admin: set a new password for someone. They are told it out of band. */
export function PasswordDialog({ userId, name }: { userId: string; name: string }) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="sm" />}>Password</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set a new password</DialogTitle>
          <DialogDescription>
            For {name}. Their current password stops working; tell them the new one.
          </DialogDescription>
        </DialogHeader>
        <PasswordForm userId={userId} onSaved={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}

function PasswordForm({ userId, onSaved }: { userId: string; onSaved: () => void }) {
  const [error, setError] = useState<string>()
  const [pending, startTransition] = useTransition()
  const form = useForm<SetPasswordInput>({
    resolver: zodResolver(setPasswordSchema),
    defaultValues: { password: '' },
  })

  function onSubmit(values: SetPasswordInput) {
    setError(undefined)
    startTransition(async () => {
      const result = await setPassword(userId, values)
      if (result.ok) {
        toast.success('Password changed')
        onSaved()
        return
      }
      setError(result.error)
      const message = result.fieldErrors?.password?.[0]
      if (message) form.setError('password', { message })
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
          name="password"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="password">New password</FieldLabel>
              <Input
                {...field}
                id="password"
                type="text"
                autoComplete="off"
                autoFocus
                aria-invalid={fieldState.invalid}
              />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
      </FieldGroup>
      <DialogFooter>
        <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Set password'}
        </Button>
      </DialogFooter>
    </form>
  )
}
