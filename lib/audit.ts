import type { Prisma } from '@/generated/prisma/client'

export type Diff = Record<string, [unknown, unknown]>

export type AuditEntry = {
  actorId?: string | null
  action: string
  entityType?: string
  entityId?: string | number
  diff?: Diff
  meta?: Prisma.InputJsonValue
  ip?: string | null
}

/** Appends an audit row. Pass the transaction client so the row commits with the write. */
export function audit(tx: Prisma.TransactionClient, entry: AuditEntry) {
  return tx.auditLog.create({
    data: {
      ...entry,
      entityId: entry.entityId?.toString(),
      diff: entry.diff as Prisma.InputJsonValue | undefined,
    },
  })
}

/**
 * Fields of `after` whose value differs from `before`, as `{ field: [before, after] }`.
 * Dates compare by instant and are stored as ISO strings; arrays (pivot id lists) compare
 * and are stored sorted. Fields absent from `after` are left out.
 */
export function diff(before: Record<string, unknown>, after: Record<string, unknown>): Diff {
  const changes: Diff = {}
  for (const key of Object.keys(after)) {
    const from = normalize(before[key])
    const to = normalize(after[key])
    if (JSON.stringify(from) !== JSON.stringify(to)) changes[key] = [from, to]
  }
  return changes
}

function normalize(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return [...value].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
  return value ?? null
}
