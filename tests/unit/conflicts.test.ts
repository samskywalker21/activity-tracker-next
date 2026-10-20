import { expect, test } from 'vitest'
import { type ConflictActivity, groupConflicts } from '@/lib/conflicts'

const row = (id: number): ConflictActivity => ({
  id,
  title: `Activity ${id}`,
  start: new Date('2026-10-27T00:00:00Z'),
  end: new Date('2026-10-27T08:00:00Z'),
  allDay: false,
  status: 'PENDING',
})
const holiday = { id: 1, name: 'All Saints', start: new Date(), end: new Date() }

test('splits clashes from same-time-only activities and counts each activity once', () => {
  const grouped = groupConflicts({
    date: [row(1), row(2), row(3)],
    participants: [row(1)],
    lgus: [row(1), row(3)],
    facilities: [],
    holidays: [holiday],
  })

  expect(grouped.clashes.map((c) => [c.id, c.shares])).toEqual([
    [1, ['participants', 'lgus']],
    [3, ['lgus']],
  ])
  expect(grouped.sameTime.map((c) => c.id)).toEqual([2])
  expect(grouped.holidays).toEqual([holiday])
  expect(grouped.total).toBe(4)
})

test('nothing found is zero', () => {
  expect(
    groupConflicts({ date: [], participants: [], lgus: [], facilities: [], holidays: [] }).total
  ).toBe(0)
})
