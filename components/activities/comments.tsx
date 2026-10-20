'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useState, useTransition } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { addComment, deleteComment, updateComment } from '@/actions/comments'
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
import { Field, FieldError } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import type { ActionResult } from '@/lib/action-result'
import { type CommentInput, commentSchema } from '@/schemas/activities'

export type CommentRow = {
  id: number
  body: string
  author: string
  mine: boolean
  /** Already formatted on the server, in APP_TIMEZONE. */
  postedAt: string
  edited: boolean
}

export function Comments({ activityId, comments }: { activityId: number; comments: CommentRow[] }) {
  return (
    <div className="grid gap-6">
      {comments.length === 0 ? (
        <p className="text-muted-foreground text-sm">No comments yet.</p>
      ) : (
        <ul className="grid gap-4">
          {comments.map((comment) => (
            <CommentItem key={comment.id} comment={comment} />
          ))}
        </ul>
      )}
      <CommentForm
        submitLabel="Comment"
        action={(values) => addComment(activityId, values)}
        resetOnSave
      />
    </div>
  )
}

function CommentItem({ comment }: { comment: CommentRow }) {
  const [editing, setEditing] = useState(false)
  const [pending, startTransition] = useTransition()

  function onDelete() {
    startTransition(async () => {
      const result = await deleteComment(comment.id)
      if (result.ok) toast.success('Comment deleted')
      else toast.error(result.error)
    })
  }

  return (
    <li className="grid gap-1 rounded-lg border p-3">
      <p className="text-muted-foreground text-xs">
        <span className="font-medium text-foreground">{comment.author}</span> · {comment.postedAt}
        {comment.edited && ' · edited'}
      </p>
      {editing ? (
        <CommentForm
          defaultBody={comment.body}
          submitLabel="Save"
          action={(values) => updateComment(comment.id, values)}
          onDone={() => setEditing(false)}
        />
      ) : (
        <p className="whitespace-pre-wrap text-sm">{comment.body}</p>
      )}
      {comment.mine && !editing && (
        <div className="flex gap-1">
          <Button variant="ghost" size="xs" onClick={() => setEditing(true)}>
            Edit
          </Button>
          <AlertDialog>
            <AlertDialogTrigger render={<Button variant="ghost" size="xs" disabled={pending} />}>
              Delete
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this comment?</AlertDialogTitle>
                <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep it</AlertDialogCancel>
                <Button variant="destructive" onClick={onDelete}>
                  Delete
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </li>
  )
}

function CommentForm({
  defaultBody = '',
  submitLabel,
  action,
  onDone,
  resetOnSave = false,
}: {
  defaultBody?: string
  submitLabel: string
  action: (values: CommentInput) => Promise<ActionResult>
  onDone?: () => void
  resetOnSave?: boolean
}) {
  const [pending, startTransition] = useTransition()
  const form = useForm<CommentInput>({
    resolver: zodResolver(commentSchema),
    defaultValues: { body: defaultBody },
  })

  function onSubmit(values: CommentInput) {
    startTransition(async () => {
      const result = await action(values)
      if (!result.ok) {
        form.setError('body', { message: result.fieldErrors?.body?.[0] ?? result.error })
        return
      }
      if (resetOnSave) form.reset()
      onDone?.()
    })
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="grid gap-2">
      <Controller
        name="body"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <Textarea
              {...field}
              rows={3}
              aria-label="Comment"
              placeholder="Write a comment…"
              aria-invalid={fieldState.invalid}
            />
            <FieldError errors={[fieldState.error]} />
          </Field>
        )}
      />
      <div className="flex justify-end gap-2">
        {onDone && (
          <Button type="button" variant="outline" size="sm" onClick={onDone}>
            Cancel
          </Button>
        )}
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </form>
  )
}
