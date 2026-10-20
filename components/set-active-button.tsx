'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import type { ActionResult } from '@/lib/action-result'

/** Activate / Deactivate with a confirmation. `name` is what the row is called, e.g. "ICTU". */
export function SetActiveButton({
  isActive,
  name,
  description,
  onConfirm,
}: {
  isActive: boolean
  name: string
  description?: string
  onConfirm: () => Promise<ActionResult>
}) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const verb = isActive ? 'Deactivate' : 'Activate'

  function confirm() {
    startTransition(async () => {
      const result = await onConfirm()
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(`${name} ${isActive ? 'deactivated' : 'activated'}`)
      setOpen(false)
    })
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger render={<Button variant="ghost" size="sm" />}>{verb}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {verb} {name}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {description ??
              (isActive
                ? 'It will no longer be offered for new entries. Existing records keep it.'
                : 'It will be offered for new entries again.')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button
            variant={isActive ? 'destructive' : 'default'}
            disabled={pending}
            onClick={confirm}
          >
            {verb}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
