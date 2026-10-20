'use client'

import { format, parse } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

// Day strings carry no time zone, so the browser's own midnight is fine for the picker.
const toDate = (day: string) => (day ? parse(day, 'yyyy-MM-dd', new Date()) : undefined)

/** A button that opens a calendar; `value` is a `yyyy-MM-dd` day or ''. */
export function DatePicker({
  id,
  value,
  onChange,
  invalid,
}: {
  id?: string
  value: string
  onChange: (day: string) => void
  invalid?: boolean
}) {
  const [open, setOpen] = useState(false)
  const date = toDate(value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            id={id}
            variant="outline"
            aria-invalid={invalid}
            className="w-full min-w-0 shrink justify-start font-normal data-[empty=true]:text-muted-foreground"
            data-empty={!date}
          />
        }
      >
        <CalendarIcon />
        {date ? format(date, 'EEE, MMM d, yyyy') : 'Pick a date'}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          defaultMonth={date}
          onSelect={(picked) => {
            onChange(picked ? format(picked, 'yyyy-MM-dd') : '')
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
