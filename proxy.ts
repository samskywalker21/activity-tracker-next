import { getSessionCookie } from 'better-auth/cookies'
import { type NextRequest, NextResponse } from 'next/server'
import { authHref } from '@/lib/next-path'

// Optimistic only: sends visitors without a session cookie to sign-in. The real checks are
// server-side (requireUser / requireRole), since a cookie can be stale or forged. The page they
// asked for rides along as `?next=` so sign-in can return them there.
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    const { pathname, search } = request.nextUrl
    return NextResponse.redirect(new URL(authHref('/sign-in', pathname + search), request.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!api/auth|sign-in|sign-up|calendar|_next/static|_next/image|brand|favicon.ico).*)',
  ],
}
