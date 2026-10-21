# Activity Tracker

Activity tracker for the DOH Center for Health Development – Northern Mindanao. Staff file
activities, managers review them, and a public calendar shows what's on.

Next.js 16 (App Router) + PostgreSQL 18 + Prisma 7 + Better Auth, with shadcn/ui (Base UI),
TanStack Table, nuqs and schedule-x. `PLAN.md` holds the business rules, data model and the
parity check against the old app; `DESIGN.md` the visual design; `CLAUDE.md` the code conventions.

## What it does

| Who     | Can                                                                                       |
| ------- | ----------------------------------------------------------------------------------------- |
| Guest   | See the public calendar (approved and pending activities, holidays) and a summary of each |
| Staff   | File activities, edit their own, cancel them with a reason, comment, export the list to CSV |
| Manager | Also review pending activities (approve, return, reject) and manage participants, facilities and holidays |
| Admin   | Everything, plus profiles, divisions, sections, LGUs and the audit log                    |

Every change and sign-in is written to the audit log. The bell in the header lists what others
did on your activities (and, for reviewers, new submissions); it checks every minute.

All dates are stored as `timestamptz` and shown in `APP_TIMEZONE` (Asia/Manila).

## Requirements

- Node.js 24, pnpm 12
- PostgreSQL 18 running locally

## Setup

```sh
pnpm install                      # also runs `prisma generate`
cp .env.example .env              # then fill in DATABASE_URL and BETTER_AUTH_SECRET
createdb -U postgres activity_tracker
createdb -U postgres activity_tracker_test
pnpm db:migrate                   # apply migrations to the dev database
pnpm db:seed                      # reference data + admin user (admin / admin)
pnpm db:samples                   # optional: sample users and activities to try it out
pnpm exec playwright install chromium
pnpm dev
```

Change the admin password after the first sign-in (Profile → Change password).

## Scripts

| Script            | What                                                          |
| ----------------- | ------------------------------------------------------------- |
| `pnpm dev`        | Dev server on http://localhost:3000                           |
| `pnpm build`      | Production build                                              |
| `pnpm start`      | Serve the production build                                    |
| `pnpm lint`       | Biome lint + format check                                     |
| `pnpm format`     | Biome fix (lint + format)                                     |
| `pnpm typecheck`  | Route type generation + `tsc --noEmit`                        |
| `pnpm test`       | Vitest: pure rules and server actions, on the test database   |
| `pnpm test:e2e`   | Playwright: flows, accessibility and phone layout (see below) |
| `pnpm db:migrate` | `prisma migrate dev`                                          |
| `pnpm db:seed`    | `prisma db seed`                                              |
| `pnpm db:samples` | Sample users and Oct–Dec 2026 activities (password = username) |
| `pnpm db:studio`  | Prisma Studio                                                 |

## Tests

- **`pnpm test`** runs `tests/unit` (rules, dates, conflicts, audit diff) and `tests/actions`
  (server actions called directly, with real Better Auth sessions) against
  `TEST_DATABASE_URL`. Files run one at a time and truncate the database.
- **`pnpm test:e2e`** builds the app, serves it on port 3100 against `TEST_DATABASE_URL`, and
  reseeds that database first (`e2e/seed.ts`: the regular seed plus `manager` / `manager` and
  `staff` / `staff`). It covers an activity's whole life across roles, an axe-core WCAG 2.1 AA
  scan of every screen in light and dark mode, and a check that no screen scrolls sideways on a
  phone. It never touches the dev database, but it shares the test database with `pnpm test`, so
  run the two one after the other.

Each change ends with `pnpm lint`, `pnpm typecheck` and `pnpm test` green.
