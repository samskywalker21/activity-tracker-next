import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'

/**
 * Server-rendered pager. Keeps every other search param and only changes `page`.
 * `searchParams` is the page's own (awaited) searchParams.
 */
export function PaginationBar({
  page,
  pageSize,
  total,
  searchParams,
}: {
  page: number
  pageSize: number
  total: number
  searchParams: Record<string, string | string[] | undefined>
}) {
  if (total === 0) return null

  const pageCount = Math.ceil(total / pageSize)
  const first = (page - 1) * pageSize + 1
  const last = Math.min(page * pageSize, total)

  const href = (target: number) => {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(searchParams)) {
      if (key === 'page' || value === undefined) continue
      for (const v of [value].flat()) params.append(key, v)
    }
    if (target > 1) params.set('page', String(target))
    const query = params.toString()
    return query ? `?${query}` : '?'
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-3 text-muted-foreground text-sm">
      <span className="tabular-nums">
        {first}–{last} of {total}
      </span>
      {pageCount > 1 && (
        <Pagination className="mx-0 w-auto">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href={href(page - 1)}
                aria-disabled={page <= 1}
                className={page <= 1 ? 'pointer-events-none opacity-50' : undefined}
              />
            </PaginationItem>
            <PaginationItem>
              <span className="px-2 tabular-nums">
                Page {page} of {pageCount}
              </span>
            </PaginationItem>
            <PaginationItem>
              <PaginationNext
                href={href(page + 1)}
                aria-disabled={page >= pageCount}
                className={page >= pageCount ? 'pointer-events-none opacity-50' : undefined}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  )
}
