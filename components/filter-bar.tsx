'use client'

import { format, parse } from 'date-fns'
import { CalendarIcon, Search } from 'lucide-react'
import { debounce, parseAsString, useQueryStates } from 'nuqs'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

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

/** A param with a few fixed choices, as tabs; `items[0]` is the default (no param). */
export function TabsFilter({
  name,
  label,
  items,
}: {
  name: string
  label: string
  items: { value: string; label: string }[]
}) {
  const [values, setParams] = useQueryStates(
    { [name]: parseAsString.withDefault(items[0].value), page: parseAsString },
    options
  )

  return (
    <Tabs
      value={values[name]}
      onValueChange={(value) =>
        setParams({ [name]: value === items[0].value ? null : value, page: null })
      }
    >
      <TabsList aria-label={label}>
        {items.map((item) => (
          <TabsTrigger key={item.value} value={item.value}>
            {item.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}

// Day strings carry no time zone, so the browser's own midnight is fine for the picker.
const toDate = (day: string | null) => (day ? parse(day, 'yyyy-MM-dd', new Date()) : undefined)
const toDay = (date: Date | undefined) => (date ? format(date, 'yyyy-MM-dd') : null)

/** `?from=&to=` as one range picker; `label` names what the days bound (e.g. "Start"). */
export function DateRangeFilter({ label }: { label: string }) {
  const [{ from, to }, setParams] = useQueryStates(
    { from: parseAsString, to: parseAsString, page: parseAsString },
    options
  )
  const range = { from: toDate(from), to: toDate(to) }
  const text = range.from
    ? `${format(range.from, 'MMM d, yyyy')}${range.to && to !== from ? ` – ${format(range.to, 'MMM d, yyyy')}` : ''}`
    : `Any ${label.toLowerCase()} date`

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            aria-label={`${label} date`}
            className="h-9 w-full justify-start bg-card font-normal sm:w-auto"
          />
        }
      >
        <CalendarIcon />
        {text}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          selected={range}
          defaultMonth={range.from}
          onSelect={(picked) =>
            setParams({ from: toDay(picked?.from), to: toDay(picked?.to), page: null })
          }
        />
        {range.from && (
          <div className="border-t p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => setParams({ from: null, to: null, page: null })}
            >
              Clear dates
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
