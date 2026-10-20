@AGENTS.md

# Activity Tracker (Next.js rewrite)

`PLAN.md` is the source of truth for scope, business rules, data model and phases. The old app in
`../activity-tracker` is the behavioural reference; don't change it.

## Code style (top priority)

Simple, straight to the point, standards-following. No abstractions until duplication is real, no
wrapper libraries or generic factories, nothing speculative. Follow the documented conventions of
Next.js, Prisma, Better Auth and shadcn.

Formatting is Biome: no semicolons, single quotes, width 100. Run `pnpm format`.

## Conventions

- Server components for reads, server actions for writes. No hand-written route handlers (Better
  Auth's `api/auth/[...all]` is the only route).
- `cacheComponents` is **off**: pages are dynamic because they read the session. No `use cache`.
- No `src/` directory: `app/`, `components/`, `lib/` etc. sit at the root; `@/*` maps to `./*`.
- Prisma client is generated into `generated/prisma` (git-ignored); import from
  `@/generated/prisma/client`.
- `proxy.ts` (Next 16 name for middleware) lives at the root.
- `components/ui/` is vendored shadcn: formatted by Biome but not linted. Don't hand-edit it.

## Auth

- `lib/auth.ts` is the Better Auth config. Sign-in is username-only (`/sign-in/email` and
  `/update-user` are disabled); the email column holds `placeholderEmail(username)`.
- `role` and `isActive` are `input: false`; Better Auth silently drops them from sign-up input.
- Inactive users are refused in the `session.create.before` database hook, and
  `getOptionalUser()` also ignores sessions of inactive users.
- Auth audit rows (sign-in success/failure, sign-out, sign-up) are written in `hooks` in
  `lib/auth.ts`, so direct calls to `/api/auth/*` are audited too.
- To create a user outside sign-up (seed, tests, admin), use `auth.$context` →
  `internalAdapter.createUser(…, { method: 'admin' })` + `linkAccount` with `password.hash()`.

## Tests

- Vitest runs against `TEST_DATABASE_URL` (set as `DATABASE_URL` in `vitest.config.mts`), one
  file at a time; `tests/helpers.ts` has `resetDb()`, `createSection()`, `createUser()`.
- Action tests mock `next/headers` **and** `next/headers.js` with a cookie jar (see
  `tests/actions/auth.test.ts`) so real sessions round-trip. `better-auth` is inlined in the
  Vitest config for that mock to reach it.

## Checks

Each phase ends with `pnpm lint`, `pnpm typecheck` and `pnpm test` green.
