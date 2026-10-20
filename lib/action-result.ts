import { z } from 'zod'

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> }

export function validationFailed(error: z.ZodError): {
  ok: false
  error: string
  fieldErrors: Record<string, string[] | undefined>
} {
  return {
    ok: false,
    error: 'Please correct the highlighted fields',
    fieldErrors: z.flattenError(error).fieldErrors,
  }
}
