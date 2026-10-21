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
  Two exceptions: `PaginationLink` renders `next/link` instead of `<a>` (shadcn's documented
  tweak), and an inactive `TabsTrigger` uses `text-muted-foreground` instead of
  `text-foreground/60`, which fails WCAG AA contrast on `bg-muted`.
- Lists and forms follow one pattern (see `app/(app)/manage/participants/`): a server page reads
  `searchParams` with `loadListParams()` (`lib/search-params.ts`), queries Prisma and renders
  `PageHeader`, `FilterBar`, a client `*Table` (`DataTable` + column defs) and `PaginationBar`.
  Create/edit is a `*Dialog` whose form calls a server action and maps `fieldErrors` onto fields.
- Activity lists (`/activities`, `/my-activities`, `/review`, dashboard, CSV export) share
  `lib/activity-list.ts`: the URL filters, `activityWhere()`, the ordering and `toActivityRow()` for
  `ActivitiesTable`.
- `/calendar` is public (outside `(app)`, excluded in `proxy.ts`). schedule-x is driven from React:
  the range comes from its callbacks, and an effect fetches `getCalendarRange` (`actions/calendar.ts`)
  for range + filters and calls `events.set`. Its config is read once, so keep `customComponents`
  module-level. Clicking an event opens a dialog; only signed-in users get the full page.
- Notifications are derived, not stored: `eventWhere()` / `commentWhere()` in
  `actions/notifications.ts` decide who hears of which `ActivityEvent` and `Comment` rows; unread
  means newer than `user.notificationsSeenAt`. The header's `NotificationBell` polls the count.
- Server actions are one file per entity in `actions/`; each write and its `audit()` row share
  a transaction, then `revalidatePath`.
- Who may edit, review or cancel an activity lives only in `lib/rules.ts` (pure, unit-tested);
  actions enforce it and pages use it to choose which buttons to show. Every status change writes
  an `ActivityEvent` in the same transaction as its audit row.
- Activity forms hold days (`yyyy-MM-dd`) and wall-clock times (`HH:mm`) in `APP_TIMEZONE`;
  `rangeToDates()` in `schemas/activities.ts` turns them into instants on the server.

## Auth

- `lib/auth.ts` is the Better Auth config. Sign-in is username-only (`/sign-in/email` and
  `/update-user` are disabled); the email column holds `placeholderEmail(username)`.
- `role` and `isActive` accept input (defaults `STAFF` / `true`), but the sign-up before-hook
  refuses either over HTTP (`ctx.request` set). Only server code passes them: the seed (the only
  way to get an admin besides an admin action) and, later, admin-only profile actions. The public
  `signUp` action passes neither, so sign-ups are active STAFF.
- `autoSignIn` is off: sign-up creates no session. The `signUp` action calls `signInUsername`
  itself. With it off, Better Auth answers a duplicate *email* with a fake success; we never hit
  that because the username plugin refuses a taken username first (emails derive from usernames).
- `proxy.ts` sends guests to `/sign-in?next=<path>`; the auth pages and the `signIn` / `signUp`
  actions return there, but only through `safeNextPath()` (`lib/next-path.ts`), which refuses
  anything that isn't a path on this site.
- Inactive users are refused in the `session.create.before` database hook, and
  `getOptionalUser()` also ignores sessions of inactive users.
- Auth audit rows (sign-in success/failure, sign-out, sign-up, own password change) are written
  in `hooks` in `lib/auth.ts`, so direct calls to `/api/auth/*` are audited too.
- To create a user from server code (seed, tests, admin actions), call `auth.api.signUpEmail`
  without headers; it hashes the password. `auth.sign_up` is only audited when headers are present
  (a real self sign-up), so the admin `createProfile` action writes its own `user.create` row.
- Admin password resets hash with `(await auth.$context).password.hash()` and update the
  `credential` account in a transaction with the audit row. Never put a password in an audit row.

## Tests

- Vitest runs against `TEST_DATABASE_URL` (set as `DATABASE_URL` in `vitest.config.mts`), one
  file at a time; `tests/helpers.ts` has `resetDb()`, `createSection()`, `createUser()` and
  `signInAs()` (which clears the audit log, so a test sees only its own rows).
- Action tests mock `next/headers` **and** `next/headers.js`, `next/navigation` and `next/cache`
  with the stand-ins in `tests/next-mocks.ts` (a cookie jar, so real sessions round-trip; copy the
  `vi.mock` lines from an existing test). `better-auth` is inlined in the Vitest config for the
  mock to reach it.
- Playwright (`e2e/`) builds and serves the app on port 3100 against the test database, reseeded
  by `e2e/seed.ts` (users `admin`, `manager`, `staff`; password = username). `signIn()`,
  `review()` and `expectAccessible()` (axe-core, WCAG 2.1 AA) are in `e2e/helpers.ts`. A new
  screen goes into `accessibility.spec.ts` and `responsive.spec.ts`.

## Checks

Every change ends with `pnpm lint`, `pnpm typecheck` and `pnpm test` green; run `pnpm test:e2e`
after UI changes.
