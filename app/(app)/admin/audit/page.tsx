import { createLoader, parseAsString } from 'nuqs/server'
import { type AuditRow, AuditTable } from '@/components/audit/audit-table'
import { DateRangeFilter, FilterBar, SearchFilter, SelectFilter } from '@/components/filter-bar'
import { PageHeader } from '@/components/page-header'
import { PaginationBar } from '@/components/pagination-bar'
import type { Prisma } from '@/generated/prisma/client'
import type { Diff } from '@/lib/audit'
import { dayRangeFilter, formatDateTime } from '@/lib/dates'
import { db } from '@/lib/db'
import { loadListParams, PAGE_SIZE } from '@/lib/search-params'
import { requireRole } from '@/lib/session'

const loadAuditFilters = createLoader({
  actor: parseAsString,
  action: parseAsString,
  entity: parseAsString,
  from: parseAsString,
  to: parseAsString,
})

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/

/** A diff or meta value as text: dates in APP_TIMEZONE, id lists joined, blanks as a dash. */
function show(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (Array.isArray(value)) return value.length ? value.join(', ') : '—'
  if (typeof value === 'string' && ISO_DATE.test(value)) return formatDateTime(new Date(value))
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export default async function AuditPage({ searchParams }: PageProps<'/admin/audit'>) {
  await requireRole(['ADMIN'])
  // `q` is the entity id, matched exactly.
  const { q, page, skip, take } = await loadListParams(searchParams)
  const filters = await loadAuditFilters(searchParams)

  const createdAt = dayRangeFilter(filters.from, filters.to)
  const where: Prisma.AuditLogWhereInput = {
    ...(filters.actor && { actorId: filters.actor }),
    ...(filters.action && { action: filters.action }),
    ...(filters.entity && { entityType: filters.entity }),
    ...(q && { entityId: q.trim() }),
    ...(createdAt && { createdAt }),
  }
  const [entries, total, actors, actions, entityTypes] = await Promise.all([
    db.auditLog.findMany({
      where,
      include: { actor: { select: { name: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip,
      take,
    }),
    db.auditLog.count({ where }),
    db.user.findMany({
      where: { auditLogs: { some: {} } },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    db.auditLog.groupBy({ by: ['action'], orderBy: { action: 'asc' } }),
    db.auditLog.groupBy({
      by: ['entityType'],
      where: { entityType: { not: null } },
      orderBy: { entityType: 'asc' },
    }),
  ])

  const rows: AuditRow[] = entries.map((entry) => ({
    id: entry.id,
    when: formatDateTime(entry.createdAt),
    actor: entry.actor?.name ?? null,
    action: entry.action,
    entity: entry.entityType && `${entry.entityType} #${entry.entityId}`,
    changes: Object.entries((entry.diff ?? {}) as Diff).map(([field, [before, after]]) => ({
      field,
      before: show(before),
      after: show(after),
    })),
    details: [
      ...Object.entries((entry.meta ?? {}) as Record<string, unknown>).map(([key, value]) => ({
        key,
        value: show(value),
      })),
      ...(entry.ip ? [{ key: 'ip', value: entry.ip }] : []),
    ],
  }))

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Every change and sign-in, newest first. Changes show the value before and after."
      />
      <FilterBar>
        <SearchFilter placeholder="Entity ID" />
        <SelectFilter
          name="actor"
          label="Actors"
          items={actors.map((a) => ({ value: a.id, label: a.name }))}
        />
        <SelectFilter
          name="action"
          label="Actions"
          items={actions.map((a) => ({ value: a.action, label: a.action }))}
        />
        <SelectFilter
          name="entity"
          label="Entities"
          items={entityTypes.map((e) => ({ value: e.entityType ?? '', label: e.entityType ?? '' }))}
        />
        <DateRangeFilter label="Logged" />
      </FilterBar>
      <AuditTable rows={rows} />
      <PaginationBar
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        searchParams={await searchParams}
      />
    </>
  )
}
