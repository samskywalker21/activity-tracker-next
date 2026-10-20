# Activity Tracker — Next.js rewrite plan

A full rewrite (not a port) of `../activity-tracker` (Nuxt 4 SPA + Nitro API + MySQL) as a
Next.js full-stack app on PostgreSQL. The old repo stays untouched as the behavioural reference —
its `CLAUDE.md`, `README.md` and `server/` handlers document every rule this plan carries over.

Scope: **feature parity + the known gaps fixed + the rule changes agreed in section 2**. Other new
features are listed under _Later_ and are **not** part of this rewrite. Production deployment is
deferred; this plan targets a working dev build first.

---

## 0. Context

| Question        | Answer                                                                                              |
| --------------- | --------------------------------------------------------------------------------------------------- |
| Who it's for    | DOH Center for Health Development – Northern Mindanao (Region 10). Staff file activities (events, monitoring visits); managers review; a public calendar shows what's on. |
| Users           | Fewer than 50, mostly desktop PCs on the office LAN. Phone matters for the calendar, but it is not the primary target. |
| Why rewrite     | 1. **Maintainability**: the old codebase carries AdonisJS → Nitro port history. 2. **Standardise on React/Next.** 3. **Better infra**: Postgres, Prisma, Better Auth, DB sessions. A new look is welcome but is **not** a driver. If time gets short, polish goes first. |
| Existing data   | The old app is **not in production**. There is nothing to migrate.                                   |
| Deadline        | None. Quality over speed; follow the phases.                                                         |

---

## 1. Decisions

| Area             | Decision                                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------- |
| Framework        | Next.js (latest stable), App Router, React 19, TypeScript `strict`                                |
| Reads / writes   | **Server components** for reads, **server actions** for writes. **No hand-written REST routes.**  |
| Database         | PostgreSQL 18, local install. `timestamptz` for every date-time                                   |
| ORM              | Prisma 7 (driver adapter `@prisma/adapter-pg`, `prisma.config.ts`)                                 |
| Auth             | Better Auth + `username` plugin, Prisma adapter, DB sessions, **7 days sliding**                  |
| UI               | shadcn/ui + Tailwind v4, TanStack Table, sonner, react-day-picker, next-themes (light + dark)     |
| Calendar         | `@schedule-x/react` (same library as today). Month grid + agenda (phone) only; no week/day views  |
| Dates            | date-fns + `@date-fns/tz`, explicit `APP_TIMEZONE=Asia/Manila`                                     |
| Forms            | react-hook-form + `@hookform/resolvers/zod`; the same Zod schema validates form and action        |
| URL state        | nuqs — filters, search and page live in the URL; server components read `searchParams`           |
| Tooling          | pnpm, Biome (lint + format), Vitest, Playwright                                                   |
| Enums            | Readable: `PENDING APPROVED RETURNED REJECTED CANCELLED`, `ADMIN MANAGER STAFF`, `EVENT MONITORING`; `isActive Boolean` replaces `'A'/'I'` |
| Data             | Fresh install. Reference data comes from a seed                                                   |
| Sign-up          | Open, account active immediately (as today)                                                       |
| Password reset   | Admin types a new password in a dialog                                                            |
| All day          | `allDay Boolean` **and** `start`/`end` always stored, snapped server-side to day bounds in `APP_TIMEZONE`. Queries never branch on the flag |
| Review scope     | Any manager or admin reviews any section, **including their own activities**, as today            |
| Deletion         | Nothing is hard-deleted except comments (by their author). Activities are cancelled; users and reference data are deactivated |
| Audit log        | One append-only `AuditLog` table covering **every write and auth event**. Admin-only screen        |
| Branding         | DOH central seal colours (green + gold). Central and regional seals **side by side** in the header and on the auth pages |
| Design           | **Fresh design.** 2–3 visual directions are mocked up and one is chosen before UI work (Phase 3)  |

### Code style — top priority

**Simple, straight to the point, professional, standards-following.** This outranks every other
preference in this plan:

- No abstractions until duplication is real and painful. Three similar lines beat a premature helper.
- No wrapper libraries, generic factories, base classes or config-driven "magic".
- No speculative code: nothing for features that are not in scope.
- Follow the documented conventions of Next.js, Prisma, Better Auth and shadcn rather than
  inventing our own.

Each server action reads top to bottom:

```ts
'use server'

export async function approveActivity(id: number, input: unknown): Promise<ActionResult<Activity>> {
  const user = await requireRole(['ADMIN', 'MANAGER'])
  const parsed = statusChangeSchema.safeParse(input)
  if (!parsed.success) return validationFailed(parsed.error)

  const activity = await db.activity.findUnique({ where: { id } })
  if (!activity) return { ok: false, error: 'Activity not found' }
  if (!canReview(user, activity)) return { ok: false, error: 'Only a pending activity can be reviewed' }

  const updated = await db.$transaction(async (tx) => {
    /* update + ActivityEvent row + audit(tx, …) */
  })

  revalidatePath('/', 'layout')
  return { ok: true, data: updated }
}
```

The only shared pieces are small, plain helpers: `requireUser()`, `requireRole()`, the
`ActionResult<T>` type, `validationFailed()`, `audit(tx, entry)`, and pure functions (`canEdit`,
`canReview`, `canCancel`, `statusAfterEdit`, `dayBounds`, `groupConflicts`, `diff`). Business
rules live in those pure functions so they can be unit-tested without a database.

---

## 2. What is being rewritten (inventory of the old app)

### Business rules — must hold exactly

Rows marked **(changed)** differ from the old app on purpose.

| Rule              | Detail                                                                                                                                       |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Lifecycle         | New activity is always `PENDING`. Reviewer: `PENDING → APPROVED / RETURNED / REJECTED`. Owner editing a `RETURNED` activity resubmits it to `PENDING`. `CANCELLED` is a cancellation. `REJECTED` and `CANCELLED` are final. |
| Edit re-pends **(changed)** | A **non-admin** creator editing an `APPROVED` activity sends it back to `PENDING` (with an `ActivityEvent`). An **admin** edit leaves an `APPROVED` activity approved. Either way the change is in the audit log. |
| History           | Every status change writes an `ActivityEvent` (`fromStatus` null on creation) **in the same transaction**. This is the user-facing status history on the activity page. |
| Reasons           | A note is **required** for RETURNED, REJECTED, CANCELLED (max 2000 chars).                                                                   |
| Edit **(changed)** | Creator or admin. Never once `REJECTED` or `CANCELLED`.                                                                                     |
| Review            | Admin or manager, any creator's activity (their own too), only from PENDING. Wrong status → error "Only a pending activity can be reviewed". |
| Cancel            | Creator from PENDING/RETURNED; admin from PENDING/RETURNED/APPROVED.                                                                         |
| Status via edit   | The edit action never accepts a status. The only implicit changes are RETURNED → PENDING and (non-admin) APPROVED → PENDING, both computed by `statusAfterEdit(user, activity)`. |
| Dates             | Past dates are allowed on create and edit (activities are often logged after the fact).                                                      |
| Section           | The activity's section defaults to the creator's section and can be changed to any active section.                                           |
| Comments          | Any signed-in user adds; **author only** edits/deletes (not admins). The only hard delete in the app.                                       |
| Profiles          | Admin manages all. A user edits only their own name/username/position/section, never role or active flag.                                    |
| Deactivation      | An inactive user cannot sign in, and their existing sessions are revoked immediately.                                                        |
| Conflict check    | Overlap = `other.start <= end AND other.end >= start`, excluding REJECTED/CANCELLED and the activity itself when editing. Buckets: `date` (all overlapping), `participants`, `lgus`, `facilities` (overlapping **and** sharing one), `holidays`. An unselected bucket returns `[]`, not a query. UI groups into "clashes" (shares something) vs "same time only" + holidays; submit asks to confirm only when anything was found. A warning, never a block. |
| Public calendar **(changed)** | Guests see APPROVED + PENDING only, activities **overlapping** the window. Scope: my section / my division / everyone (remembered per browser; guests = everyone). Holidays drawn as background. Clicking an activity shows a **popover** (title, time, venue, status, section). For guests, the detail page needs sign-in. |
| Notifications **(changed)** | Derived, not stored, newer than `user.notificationsSeenAt`, never your own actions. **Creators** see status changes and comments by others on activities they created. **Reviewers** (manager/admin) also see: new submissions, resubmissions (any → PENDING), cancellations and comments on PENDING activities. If one item qualifies twice, it appears once. Bell polls the unread count every 60s and on tab focus. Opening it marks all seen but keeps highlighting what was new at open time. |
| Audit log **(new)** | Every write (activities, status changes, comments, profiles, reference data) and auth event (sign-in success/failure, sign-out, sign-up, own password change, admin password reset) appends an `AuditLog` row. Data writes add it in the **same transaction**. It stores a field diff (before → after; pivots as id lists) and never passwords, hashes or tokens. Admin-only. |
| Holidays          | Snapped to whole days in `APP_TIMEZONE`; end may not precede start.                                                                          |
| Activity search   | Title, owner, venue, creator's names, section/division name and code. Filters: creator, type, virtual, status, section, division, start-range. Lists ordered `createdAt desc, id desc`; the review queue defaults to oldest first, with a newest-first toggle. Every signed-in user sees all activities. |
| CSV export        | Any signed-in user. Same filters as the list, all pages, ordered by start. UTF-8 **with BOM**, local wall-clock dates, pivots joined with `; `, human labels. |
| Validation        | Title/owner/venue min 4; profile names 2–50; username 4–100; password 4–100; position 4–30; division/section code ≤ 10; participant/holiday name min 3. |

### Screens (old → new route)

| Old                                         | New                                      | Who               |
| ------------------------------------------- | ---------------------------------------- | ----------------- |
| `/login`, `/register`                       | `/sign-in`, `/sign-up`                   | guest             |
| `/calendar`                                 | `/calendar`                              | everyone          |
| `/` dashboard                               | `/`                                      | signed in         |
| `/list` (+ export)                          | `/activities`                            | signed in         |
| `/activities/add`                           | `/activities/new`                        | signed in         |
| `/activities/:id` (+ Edit modal)            | `/activities/[id]`, `/activities/[id]/edit` | signed in (edit: per `canEdit`) |
| `/activities/pending`, `approved`, `revision` | `/my-activities?status=…` (one page, tabs) | signed in       |
| `/manage/activities`                        | `/review`                                | manager, admin    |
| `/manage/participants`, `facilities`, `holidays` | same paths                          | manager, admin    |
| `/admin/profiles`                           | `/admin/profiles`                        | admin             |
| — (API only, no UI)                         | `/admin/divisions`, `/admin/sections`, `/admin/lgus` | admin |
| —                                           | `/admin/audit` (filter by actor, action, entity, date range) | admin |
| `/profile`                                  | `/profile`                               | signed in         |
| `/design/*` (dev mock-ups)                  | dropped                                  | —                 |

### Gaps fixed in the rewrite

1. Password reset is no longer a hardcoded `12345678` in client code. The admin types one.
2. Divisions, sections and LGUs get admin screens (APIs existed, UI was commented out).
3. Comments get edit/delete UI for their author.
4. The empty "Reports" menu heading is removed (Reports is a _Later_ feature).
5. No hidden "participant #1" special case. The "Others" row is simply not seeded; the free-text
   `otherParticipants` field covers it.
6. Facilities get `isActive` like the other reference data.
7. One explicit timezone (`APP_TIMEZONE`) used by server and calendar alike; `timestamptz` columns.
8. Seeding is a standalone `prisma db seed`; no dev server required.
9. Real `allDay` flag instead of guessing from 00:00–23:59.
10. Deactivating a user revokes their sessions immediately (DB sessions).
11. Editing an approved activity can no longer silently change an approved plan: a non-admin edit re-pends it.
12. `REJECTED` is final (it was editable before).
13. Audit log for every write and auth event.
14. Reviewers are notified (moved in from _Later_), and creators are notified of comments.
15. Guests no longer open full activity pages; they get a calendar popover.

---

## 3. Data model (Prisma sketch)

Better Auth owns `User`, `Session`, `Account`, `Verification` (string ids). Profile fields are
Better Auth `additionalFields` on `User`: one table, no 1:1 profile join. Domain tables use
`Int @id @default(autoincrement())` for readable URLs (`/activities/123`).

```prisma
enum Role           { ADMIN MANAGER STAFF }
enum ActivityStatus { PENDING APPROVED RETURNED REJECTED CANCELLED }
enum ActivityType   { EVENT MONITORING }

model User {            // Better Auth core fields + ours
  id                   String   @id
  name                 String   // "First Last", kept in sync on write (Better Auth requires it)
  email                String   @unique  // placeholder `<username>@activity-tracker.local` — see Risks
  emailVerified        Boolean  @default(false)
  username             String?  @unique
  displayUsername      String?
  firstName            String
  middleName           String?
  lastName             String
  position             String
  sectionId            Int
  role                 Role     @default(STAFF)
  isActive             Boolean  @default(true)
  notificationsSeenAt  DateTime @default(now()) @db.Timestamptz
  createdAt / updatedAt
  section Section @relation(...)
  // sessions, accounts, createdActivities, updatedActivities, comments, events, auditLogs
}

model Division  { id Int @id @default(autoincrement()); code String @unique @db.VarChar(10); name String; isActive Boolean @default(true); sections Section[]; timestamps }
model Section   { id, code @unique @db.VarChar(10), name, divisionId, isActive, timestamps }
model Lgu       { id String @id /* PSGC code */; provinceId Int; province String; muncity String; isActive; activities Activity[] }
model Participant { id, name, isInternal Boolean, isActive, activities Activity[] }
model Facility  { id, name, isActive, activities Activity[] }
model Holiday   { id, name, start DateTime @db.Timestamptz, end DateTime @db.Timestamptz }

model Activity {
  id          Int            @id @default(autoincrement())
  title       String
  type        ActivityType
  virtual     Boolean        @default(false)
  allDay      Boolean        @default(false)
  start       DateTime       @db.Timestamptz
  end         DateTime       @db.Timestamptz
  status      ActivityStatus @default(PENDING)
  owner       String         // free-text name of the person responsible (not necessarily the creator)
  venue       String
  prNo        String?        // procurement Purchase Request number
  remarks     String?
  others      String?        // misc notes
  otherParticipants, otherLgu, otherFacilities  String?   // free text beyond the pick lists
  sectionId   Int            // defaults to creator's section in the form
  createdById String
  updatedById String
  participants Participant[]   // implicit many-to-many: sync is `{ set: ids.map(id => ({ id })) }`
  lgus         Lgu[]
  facilities   Facility[]
  comments     Comment[]
  events       ActivityEvent[]
  timestamps
  @@index([status, start, end])
}

model ActivityEvent {   // append-only, user-facing status history
  id, activityId, actorId String, fromStatus ActivityStatus?, toStatus ActivityStatus, note String?, createdAt
  @@index([createdAt])
}

model Comment { id, body String, activityId, authorId String, timestamps
  @@index([createdAt])
}

model AuditLog {        // append-only, admin-only
  id         Int      @id @default(autoincrement())
  createdAt  DateTime @default(now()) @db.Timestamptz
  actorId    String?  // null for failed sign-in / guest actions
  action     String   // 'activity.create' | 'activity.update' | 'activity.status' | 'comment.delete' | 'user.set_role' | 'auth.sign_in_failed' | …
  entityType String?  // 'Activity' | 'Comment' | 'User' | 'Section' | …
  entityId   String?
  diff       Json?    // { field: [before, after] }; pivots as sorted id lists
  meta       Json?    // e.g. { username } on a failed sign-in
  ip         String?
  @@index([createdAt])
  @@index([entityType, entityId])
  @@index([actorId])
}
```

All foreign keys `onDelete: Restrict` (AuditLog has no FK to the entity, only to the actor).
Implicit many-to-many replaces the hand-written pivot sync: `set` replaces the whole list inside
the activity update, and an absent field leaves it alone.

---

## 4. Project structure

```text
prisma/
  schema.prisma
  migrations/
  seed.ts                 # divisions, sections, admin user (via Better Auth), LGUs, participants, facilities
  data/lgus.ts            # Region 10 PSGC list, from the old server/database/data/muncity.ts
prisma.config.ts
public/brand/             # doh-central.png, chd-nm.png (copied from the old public/)
generated/prisma/        # Prisma client output (git-ignored)
app/
  (auth)/sign-in/page.tsx, sign-up/page.tsx
  (public)/calendar/page.tsx
  (app)/layout.tsx      # requireUser(); sidebar + header (bell)
    page.tsx            # dashboard
    activities/page.tsx, new/page.tsx, [id]/page.tsx, [id]/edit/page.tsx
    my-activities/page.tsx
    review/page.tsx
    manage/participants|facilities|holidays/page.tsx
    admin/profiles|divisions|sections|lgus|audit/page.tsx
    profile/page.tsx
  api/auth/[...all]/route.ts   # Better Auth's own handler — the only route
  not-found.tsx, error.tsx
actions/                # 'use server' — one file per area
  activities.ts         # create, update, changeStatus, checkConflicts, exportCsv
  comments.ts           # add, edit, delete
  calendar.ts           # getCalendarRange (public), getHolidays (public)
  notifications.ts      # getUnreadCount, getNotifications, markSeen
  divisions.ts, sections.ts, lgus.ts, participants.ts, facilities.ts, holidays.ts  # reference data, one file each
  profiles.ts           # admin: create, update, setActive, setRole, setPassword; self: updateOwn, changeOwnPassword
lib/
  db.ts                 # Prisma client singleton
  auth.ts               # Better Auth server config (+ hooks that write auth audit rows)
  auth-client.ts        # Better Auth React client
  session.ts            # requireUser(), requireRole(), getOptionalUser()
  queries/              # 'server-only' read functions used by server components
  rules.ts              # canEdit, canReview, canCancel, statusAfterEdit, allowedTransitions — pure
  dates.ts              # APP_TIMEZONE, dayBounds(), formatRange() — pure
  conflicts.ts          # groupConflicts() — pure
  audit.ts              # audit(tx, entry) + diff(before, after) — diff is pure
  status.ts             # labels, colours, icons for statuses/roles/types
  action-result.ts      # ActionResult<T>, validationFailed()
schemas/                # Zod, shared by forms and actions
components/
  ui/                   # shadcn
  ...                   # feature components
proxy.ts                  # optimistic redirect to /sign-in when no session cookie (real checks are server-side)
tests/
  unit/                   # rules, dates, conflicts, diff
  actions/                # server actions called directly against a Postgres test DB
e2e/                      # Playwright
```

**Reads that happen after page load** (calendar range change, live conflict check, bell count)
are server actions called from client components. They are POST-only and run one at a time per
client, which is fine at this scale.

**Revalidation:** every page reads the session, so pages are dynamic. After a write, actions call
`revalidatePath` (`'/', 'layout'` for activity writes; the specific page for reference data). No
`use cache` in this rewrite.

---

## 5. Phases

Each phase ends runnable, with `pnpm biome check`, `pnpm tsc --noEmit` and `pnpm test` green.

### Phase 0 — Scaffold
- `create-next-app` (TypeScript, App Router, Tailwind v4, no `src/` dir), pnpm, Biome config (port the old
  Prettier style: no semis, single quotes, width 100), remove ESLint.
- shadcn init; next-themes; sonner.
- Postgres 18: create `activity_tracker` and `activity_tracker_test` databases.
- Prisma 7 init with `prisma.config.ts` and the pg adapter; `.env.example` (`DATABASE_URL`,
  `TEST_DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `APP_TIMEZONE`).
- Copy `central.png` / `region.png` into `public/brand/`.
- Vitest (node env) and Playwright configured with one smoke test each.
- `README.md` and `CLAUDE.md` started.

### Phase 1 — Data layer
- Full `schema.prisma` (incl. `AuditLog`), first migration.
- `prisma/seed.ts` standalone (`pnpm db:seed`), idempotent per table. The admin user is created
  through Better Auth's server API so the password is hashed by the same code that verifies it.
- `lib/db.ts`, `lib/dates.ts` (`dayBounds`, formatting in `APP_TIMEZONE`), `lib/audit.ts`
  (`audit`, `diff`) with unit tests.

### Phase 2 — Auth
- Better Auth: username plugin, Prisma adapter, `session.expiresIn` 7 days with `updateAge` 1 day,
  `additionalFields` for the profile columns (`role`, `isActive` not user-settable).
- Block inactive users at sign-in (database hook on session create); `setActive(false)` deletes
  that user's sessions.
- Auth audit rows from Better Auth hooks: sign-in (success / failure with attempted username + IP),
  sign-out, sign-up.
- Sign-in and sign-up pages (sign-up loads active sections; role always STAFF).
- `lib/session.ts`: `requireUser()`, `requireRole()`, `getOptionalUser()`. `proxy.ts` redirect.
- Tests: sign-in, inactive refused, role guards, audit rows for sign-in success/failure.

### Phase 3 — Design directions, then the shell
- Brand inputs: DOH central seal green (≈ `#00703C`) and gold (≈ `#FCD116`), with Philippine
  blue/red from the shield available. Both seals side by side in the header and on the auth
  pages. Should feel like a government office system, clean rather than flashy.
- Produce **three** directions (dashboard, calendar, activity form; light and dark) as a shareable page:
  - **A.** Green primary, gold as a thin accent (header rule, focus ring), neutral surfaces.
  - **B.** Solid seal-green sidebar/header, white text, gold active indicator.
  - **C.** A third option, chosen when the mock-ups are made.
  Each one shows how **status colours** avoid clashing with the brand green (e.g. icon + label
  badges with tinted hues, or blue for APPROVED). **You pick one.**
- Write `DESIGN.md` for the chosen direction (tokens, status colours/icons, spacing, table and
  form rules), then build: theme tokens, app shell (sidebar by role, header with seals, user menu,
  theme toggle), page header, data table, pagination, filter bar, empty/loading/error states.

### Phase 4 — Reference data and profiles
- Admin: divisions, sections, LGUs (new screens); profiles (list, search, create, edit,
  activate/deactivate, change role, set password).
- Manager + admin: participants, facilities, holidays (holiday days snapped via `dayBounds`).
- Self: `/profile` — edit own details, change own password (requires current; signs out after).
- Every write audited in its transaction.
- Action tests for the profile permission matrix, username uniqueness, and audit rows
  (incl. password changes recorded without the password).

### Phase 5 — Activities core
- Activity form (create + edit) with the date/time pickers, All day toggle, section (defaults to
  own) / participant / LGU / facility pickers, overflow text fields, live debounced conflict check,
  confirm-on-conflict. When a non-admin edits an APPROVED activity, the form warns that saving
  sends it back for review.
- `/activities/[id]`: details, status alert with reason, tabs (participants, LGUs, facilities,
  history, comments), and only the actions `rules.ts` allows.
- Status change dialog (approve / return / reject / cancel, reason required where needed).
- Comments: add, edit own, delete own.
- Tests: every transition in the rules table (allowed and refused, per role), approved-edit
  re-pend (staff) vs stays approved (admin), REJECTED not editable, event + audit rows written in
  the same transaction, resubmission, conflict buckets incl. the absent-bucket rule.

### Phase 6 — Lists and dashboard
- `/activities`: search + filters in the URL (nuqs), pagination, CSV export (server action returns
  the CSV text; the browser downloads it as a Blob, with BOM).
- `/my-activities` (Pending / Approved / Returned tabs), `/review` queue.
- Dashboard: counts, "needs your attention" (returned items with reason, review queue count for
  reviewers), recent activity (own section for non-admins, with a toggle to all; admins see all).

### Phase 7 — Public calendar
- schedule-x month grid + agenda (phone), `APP_TIMEZONE`, statuses as calendars, holidays as
  background events, scope selector (remembered in localStorage), type/status filters.
- Click → popover; "Open" link to the detail page for signed-in users, "Sign in to see more" for guests.

### Phase 8 — Notifications and audit screen
- Bell: unread count (60s poll + on focus), list on open, mark seen, keep "new" dots for the open
  session, link to the activity. Sources: creator events + comments; reviewer submissions,
  resubmissions, cancellations, comments on pending; deduplicated.
- `/admin/audit`: paginated table, filters (actor, action, entity type/id, date range), diff
  shown as before → after per field.
- Tests: notification derivation per role (own actions excluded, dedupe, seen cut-off).

### Phase 9 — Hardening
- Playwright flows: sign-in; submit an activity; manager approves; staff edits the approved
  activity → back to pending; manager returns → owner edits → resubmitted; owner cancels with
  reason; guest views the public calendar and gets the popover only.
- Accessibility pass (keyboard, focus, labels), responsive pass (desktop first, then tablet/phone).
- `README.md`, `CLAUDE.md` finished; parity checklist (section 2) ticked off against the old app.

---

## 6. Testing

| Layer          | Tool        | What                                                                                     |
| -------------- | ----------- | ---------------------------------------------------------------------------------------- |
| Rules          | Vitest      | `rules.ts`, `dates.ts`, `conflicts.ts`, `diff` — pure, no DB, full coverage              |
| Server actions | Vitest      | Called directly as async functions against `activity_tracker_test`. `requireUser` is mocked to return an admin / manager / staff fixture; `next/cache` is mocked. Covers validation, permissions, transactions, history and audit rows, pivot replacement, notification queries. Tables truncated between files; files run serially. |
| Flows          | Playwright  | The flows in Phase 9, against `pnpm dev` with a seeded test DB                           |

Server components are covered by Playwright, not unit tests.

---

## 7. Risks and things to verify at scaffold time

- **Better Auth requires `email`.** The app is username-only, so sign-up and seed set a
  placeholder `<username>@activity-tracker.local`; the field is never shown. Confirm the username
  plugin's current behaviour.
- **Admin password set.** Prefer Better Auth's own API for hashing (admin plugin `setUserPassword`,
  or the auth context's password hasher). If the admin plugin's role model fights our `Role` enum,
  keep our own `role` column and use only the hashing utility.
- **Auth audit hooks.** Confirm Better Auth exposes a reliable hook for *failed* sign-ins (likely
  an `after` hook on the username sign-in endpoint that inspects the response) and gives access
  to the client IP behind a future reverse proxy.
- **Reviewer notification query.** Derived from `ActivityEvent` + `Comment` with role-dependent
  conditions and dedupe; keep it one readable query (or two merged in code). With fewer than 50
  users that is plenty. If it gets convoluted, reconsider a stored `Notification` table.
- **Prisma 7 / Next.js versions**: check current docs for the `prisma-client` generator with a
  required `output`, driver adapters, `prisma.config.ts`, and Next's `proxy.ts` (formerly
  `middleware.ts`) and async `params`/`searchParams`.
- **Server actions as reads** run serially per client; if the conflict check and the bell ever
  feel slow together, revisit.
- **Plain HTTP on the LAN later**: Better Auth must not set `Secure` cookies over `http://<ip>`.
  Solve in the production phase.

---

## 8. Open questions

- Direction **C** for the design, and the status-colour approach: decided from the Phase 3 mock-ups.
- Comment notifications go only to the creator (and to reviewers while PENDING). Should other
  people who commented on the same activity be notified too? Assumed **no**.
- Audit log retention: kept forever (assumed; volume is tiny at this scale).

## 9. Later (not in this rewrite)

- **Reports & analytics**: counts by section/status/month, LGU coverage, exports.

## 10. Production (deferred)

Server with local PostgreSQL 18; possibly Laragon + nginx (reverse proxy / load balancing) in
front of `next start` / standalone output. To decide later: process manager / Windows service,
HTTP vs HTTPS (cookie `Secure` flag), backups (`pg_dump` schedule), multiple instances (sessions
are in Postgres, so they are already shared), and a deploy script.
