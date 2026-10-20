import { createLoader, parseAsInteger, parseAsString, parseAsStringLiteral } from 'nuqs/server'

export const PAGE_SIZE = 20

const loader = createLoader({
  q: parseAsString.withDefault(''),
  status: parseAsStringLiteral(['active', 'inactive']),
  page: parseAsInteger.withDefault(1),
})

/** `?q=&status=&page=` for the reference-data and profile lists. */
export async function loadListParams(
  searchParams: Promise<Record<string, string | string[] | undefined>>
) {
  const params = await loader(searchParams)
  const page = Math.max(1, params.page)
  return { ...params, page, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }
}

/** Prisma `where` for the status filter. */
export function statusWhere(status: 'active' | 'inactive' | null) {
  return status ? { isActive: status === 'active' } : {}
}

export const statusItems = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
]
