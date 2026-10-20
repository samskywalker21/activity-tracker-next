'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { setRole } from '@/actions/profiles'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Role } from '@/generated/prisma/enums'
import { roleLabels } from '@/lib/status'

const items = Object.values(Role).map((role) => ({
  value: role,
  label: roleLabels[role],
}))

/** Picking a new role asks for confirmation before it is saved. */
export function RoleSelect({
  userId,
  name,
  role,
  disabled,
}: {
  userId: string
  name: string
  role: Role
  disabled?: boolean
}) {
  // The role picked but not yet confirmed; the select keeps showing the saved one until then.
  const [next, setNext] = useState<Role | null>(null)
  const [pending, startTransition] = useTransition()

  function confirm() {
    if (!next) return
    startTransition(async () => {
      const result = await setRole(userId, next)
      if (result.ok) toast.success(`${name} is now ${roleLabels[next].toLowerCase()}`)
      else toast.error(result.error)
      setNext(null)
    })
  }

  return (
    <>
      <Select
        items={items}
        value={role}
        onValueChange={(value) => value && value !== role && setNext(value)}
        disabled={disabled || pending}
      >
        <SelectTrigger size="sm" aria-label={`Role of ${name}`} className="w-28">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <AlertDialog open={next !== null} onOpenChange={(open) => !open && setNext(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Make {name} {next && roleLabels[next].toLowerCase()}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {roleLabels[role]} → {next && roleLabels[next]}. It applies to what they can do from
              their next page load.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button disabled={pending} onClick={confirm}>
              Change role
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
