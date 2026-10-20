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

## Checks

Each phase ends with `pnpm lint`, `pnpm typecheck` and `pnpm test` green.
