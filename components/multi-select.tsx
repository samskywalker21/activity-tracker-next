'use client'

import { Fragment } from 'react'
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from '@/components/ui/combobox'

type Option<V> = { value: V; label: string }

/** A searchable multi-select with chips, holding plain values (ids) rather than options. */
export function MultiSelect<V extends string | number>({
  id,
  items,
  value,
  onChange,
  placeholder,
  invalid,
}: {
  id?: string
  items: Option<V>[]
  value: V[]
  onChange: (value: V[]) => void
  placeholder?: string
  invalid?: boolean
}) {
  const anchor = useComboboxAnchor()
  const selected = items.filter((item) => value.includes(item.value))

  return (
    <Combobox
      multiple
      autoHighlight
      items={items}
      // Long lists (LGUs) only render the first matches; typing narrows them.
      limit={100}
      value={selected}
      onValueChange={(options) => onChange(options.map((option) => option.value))}
      isItemEqualToValue={(item, current) => item.value === current.value}
    >
      <ComboboxChips ref={anchor} className="w-full">
        <ComboboxValue>
          {(options: Option<V>[]) => (
            <Fragment>
              {options.map((option) => (
                <ComboboxChip key={option.value}>{option.label}</ComboboxChip>
              ))}
              <ComboboxChipsInput
                id={id}
                placeholder={options.length ? undefined : placeholder}
                aria-invalid={invalid}
              />
            </Fragment>
          )}
        </ComboboxValue>
      </ComboboxChips>
      <ComboboxContent anchor={anchor}>
        <ComboboxEmpty>No matches.</ComboboxEmpty>
        <ComboboxList>
          {(option: Option<V>) => (
            <ComboboxItem key={option.value} value={option}>
              {option.label}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
