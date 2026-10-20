import { SearchX } from 'lucide-react'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'

/** The empty state of a filterable list. `what` is plural, e.g. "participants". */
export function NoResults({ what }: { what: string }) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SearchX />
        </EmptyMedia>
        <EmptyTitle>No {what} found</EmptyTitle>
        <EmptyDescription>Try another search or filter, or add one.</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}
