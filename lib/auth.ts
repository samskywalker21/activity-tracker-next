import { type BetterAuthOptions, betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import {
  APIError,
  createAuthMiddleware,
  getIP,
  getSessionFromCtx,
  isAPIError,
} from 'better-auth/api'
import { nextCookies } from 'better-auth/next-js'
import { username } from 'better-auth/plugins'
import { audit } from '@/lib/audit'
import { db } from '@/lib/db'

// The app is username-only, but Better Auth requires a unique email. Never shown.
export const placeholderEmail = (name: string) => `${name.toLowerCase()}@activity-tracker.local`

export const auth = betterAuth({
  database: prismaAdapter(db, { provider: 'postgresql' }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 4,
    maxPasswordLength: 100,
    // Sign-up only creates the user; the sign-up action signs in explicitly afterwards.
    autoSignIn: false,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days, sliding:
    updateAge: 60 * 60 * 24, // extended at most once a day
  },
  user: {
    additionalFields: {
      firstName: { type: 'string', required: true },
      middleName: { type: 'string', required: false },
      lastName: { type: 'string', required: true },
      position: { type: 'string', required: true },
      sectionId: { type: 'number', required: true },
      // Accepted as input so server code (seed, admin actions) can set them; refused over HTTP below.
      role: { type: ['ADMIN', 'MANAGER', 'STAFF'], defaultValue: 'STAFF' },
      isActive: { type: 'boolean', defaultValue: true },
    },
  },
  // Username sign-in only; profile edits go through the app's own (audited) actions.
  disabledPaths: ['/sign-in/email', '/update-user'],
  databaseHooks: {
    session: {
      create: {
        // Every sign-in path creates a session, so this is the one place to refuse inactive users.
        before: async (session) => {
          const user = await db.user.findUnique({
            where: { id: session.userId },
            select: { isActive: true },
          })
          if (!user?.isActive) {
            throw new APIError('FORBIDDEN', { message: 'This account has been deactivated' })
          }
        },
      },
    },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === '/sign-up/email') {
        // `ctx.request` is only set for HTTP calls; `auth.api.*` calls from our own server code
        // have none. The public sign-up action passes neither, so sign-ups are active STAFF.
        if (ctx.request && (ctx.body.role !== undefined || ctx.body.isActive !== undefined)) {
          throw new APIError('FORBIDDEN', { message: 'You cannot set your own role or status' })
        }
        const { username, firstName, lastName } = ctx.body
        return {
          context: {
            body: {
              ...ctx.body,
              email: placeholderEmail(username),
              name: `${firstName} ${lastName}`,
            },
          },
        }
      }

      // Recorded before the handler runs, while the session still exists.
      if (ctx.path === '/sign-out') {
        const session = await getSessionFromCtx(ctx)
        if (session) {
          await audit(db, { actorId: session.user.id, action: 'auth.sign_out', ip: clientIp(ctx) })
        }
      }
    }),
    after: createAuthMiddleware(async (ctx) => {
      const returned = ctx.context.returned
      const failed = isAPIError(returned)

      if (ctx.path === '/sign-in/username') {
        if (failed) {
          await audit(db, {
            action: 'auth.sign_in_failed',
            meta: { username: ctx.body?.username ?? null, reason: returned.message },
            ip: clientIp(ctx),
          })
        } else if (ctx.context.newSession) {
          await audit(db, {
            actorId: ctx.context.newSession.user.id,
            action: 'auth.sign_in',
            ip: clientIp(ctx),
          })
        }
      }

      // No session after sign-up (autoSignIn is off), so the new user comes from the response.
      if (ctx.path === '/sign-up/email' && !failed) {
        const { user } = returned as { user: { id: string } }
        await audit(db, {
          actorId: user.id,
          action: 'auth.sign_up',
          entityType: 'User',
          entityId: user.id,
          ip: clientIp(ctx),
        })
      }
    }),
  },
  plugins: [
    username({ minUsernameLength: 4, maxUsernameLength: 100 }),
    nextCookies(), // must stay last
  ],
})

function clientIp(ctx: {
  request?: Request
  headers?: Headers
  context: { options: BetterAuthOptions }
}) {
  const source = ctx.request ?? ctx.headers
  return source ? getIP(source, ctx.context.options) : null
}

export type SessionUser = typeof auth.$Infer.Session.user
