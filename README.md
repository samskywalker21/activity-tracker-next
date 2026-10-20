# Activity Tracker

Activity tracker for the DOH Center for Health Development – Northern Mindanao. Staff file
activities, managers review them, and a public calendar shows what's on.

Next.js (App Router) + PostgreSQL 18 + Prisma 7 + Better Auth. See `PLAN.md` for the rewrite plan.

## Requirements

- Node.js 24, pnpm 12
- PostgreSQL 18 running locally

## Setup

```sh
pnpm install                      # also runs `prisma generate`
cp .env.example .env              # then fill in DATABASE_URL and BETTER_AUTH_SECRET
createdb -U postgres activity_tracker
createdb -U postgres activity_tracker_test
pnpm exec playwright install chromium
pnpm dev
```

## Scripts

| Script            | What                                    |
| ----------------- | --------------------------------------- |
| `pnpm dev`        | Dev server on http://localhost:3000     |
| `pnpm build`      | Production build                        |
| `pnpm lint`       | Biome lint + format check               |
| `pnpm format`     | Biome fix (lint + format)               |
| `pnpm typecheck`  | Route type generation + `tsc --noEmit`  |
| `pnpm test`       | Vitest (unit + server action tests)     |
| `pnpm test:e2e`   | Playwright (starts `pnpm dev` if needed) |
| `pnpm db:migrate` | `prisma migrate dev`                    |
| `pnpm db:seed`    | `prisma db seed`                        |
| `pnpm db:studio`  | Prisma Studio                           |
