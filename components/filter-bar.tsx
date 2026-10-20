'use client'

import { Search } from 'lucide-react'
import { debounce, parseAsString, useQueryStates } from 'nuqs'
import type { ReactNode } from 'react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// Filters live in the URL. `shallow: false` re-runs the server component; changing a filter
// always clears `page`, so the list never lands on a page that no longer exists.
const options = { shallow: false } as const

export function FilterBar({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>
}

export function SearchFilter({ placeholder = 'Search' }: { placeholder?: string }) {
  const [{ q }, setParams] = useQueryStates(
    { q: parseAsString.withDefault(''), page: parseAsString },
    options
  )

  return (
    <div className="relative w-full sm:w-72">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        defaultValue={q}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-9 bg-card pl-9"
        onChange={(event) =>
          setParams(
            { q: event.target.value || null, page: null },
            { limitUrlUpdates: event.target.value ? debounce(300) : undefined }
          )
        }
      />
    </div>
  )
}

export function SelectFilter({
  name,
  label,
  items,
}: {
  name: string
  label: string
  items: { value: string; label: string }[]
}) {
  const [values, setParams] = useQueryStates(
    { [name]: parseAsString, page: parseAsString },
    options
  )
  const allItems = [{ value: null, label: `All ${label.toLowerCase()}` }, ...items]

  return (
    <Select
      items={allItems}
      value={values[name] ?? null}
      onValueChange={(value) => setParams({ [name]: value, page: null })}
    >
      <SelectTrigger aria-label={label} className="h-9 w-full bg-card sm:w-44">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {allItems.map((item) => (
          <SelectItem key={item.value ?? ''} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
