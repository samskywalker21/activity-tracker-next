/**
 * The `?next=` path to return to after signing in, or `/`. Only a path on this site is accepted
 * (not `//host` or `/\host`, which browsers treat as another origin), so it can't redirect away.
 */
export function safeNextPath(next: unknown) {
  if (typeof next !== 'string' || !next.startsWith('/')) return '/'
  if (next.startsWith('//') || next.startsWith('/\\')) return '/'
  return next
}

/** `/sign-in` or `/sign-up`, carrying `next` along when it isn't the dashboard. */
export function authHref(path: '/sign-in' | '/sign-up', next: string) {
  return next === '/' ? path : `${path}?${new URLSearchParams({ next })}`
}
