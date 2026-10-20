import { describe, expect, test } from 'vitest'
import { APP_TIMEZONE, dayBounds, formatDay, formatRange, parseDay } from '@/lib/dates'

// Asia/Manila is UTC+8 all year (no DST).
test('tests run in Asia/Manila', () => {
  expect(APP_TIMEZONE).toBe('Asia/Manila')
})

describe('dayBounds', () => {
  test('snaps to the start and end of the day in Manila, not UTC', () => {
    const { start, end } = dayBounds(new Date('2026-10-22T03:00:00Z')) // 11:00 Manila
    expect(start.toISOString()).toBe('2026-10-21T16:00:00.000Z')
    expect(end.toISOString()).toBe('2026-10-22T15:59:59.999Z')
  })

  test('an instant late in the UTC day belongs to the next Manila day', () => {
    const { start } = dayBounds(new Date('2026-10-22T20:00:00Z')) // Oct 23, 04:00 Manila
    expect(start.toISOString()).toBe('2026-10-22T16:00:00.000Z')
  })

  test('spans from the first day to the last', () => {
    const { start, end } = dayBounds(
      new Date('2026-10-23T01:00:00Z'),
      new Date('2026-10-24T09:00:00Z')
    )
    expect(start.toISOString()).toBe('2026-10-22T16:00:00.000Z')
    expect(end.toISOString()).toBe('2026-10-24T15:59:59.999Z')
  })
})

describe('formatRange', () => {
  const at = (iso: string) => new Date(`${iso}+08:00`)

  test('all day, one day', () => {
    const { start, end } = dayBounds(at('2026-10-22T00:00'))
    expect(formatRange(start, end, true)).toBe('Oct 22, 2026 · All day')
  })

  test('all day, several days in one month', () => {
    const { start, end } = dayBounds(at('2026-10-23T00:00'), at('2026-10-24T00:00'))
    expect(formatRange(start, end, true)).toBe('Oct 23–24, 2026 · All day')
  })

  test('all day, across months and years', () => {
    expect(formatRange(at('2026-10-30T00:00'), at('2026-11-02T23:59'), true)).toBe(
      'Oct 30 – Nov 2, 2026 · All day'
    )
    expect(formatRange(at('2026-12-30T00:00'), at('2027-01-02T23:59'), true)).toBe(
      'Dec 30, 2026 – Jan 2, 2027 · All day'
    )
  })

  test('same day, same half of the day', () => {
    expect(formatRange(at('2026-10-27T13:00'), at('2026-10-27T17:00'), false)).toBe(
      'Oct 27, 2026 · 1:00–5:00 PM'
    )
  })

  test('same day, morning to afternoon', () => {
    expect(formatRange(at('2026-10-30T09:00'), at('2026-10-30T14:30'), false)).toBe(
      'Oct 30, 2026 · 9:00 AM – 2:30 PM'
    )
  })

  test('several days with times', () => {
    expect(formatRange(at('2026-10-26T08:00'), at('2026-10-28T17:00'), false)).toBe(
      'Oct 26, 2026, 8:00 AM – Oct 28, 2026, 5:00 PM'
    )
  })
})

describe('parseDay / formatDay', () => {
  test('a day string is the start of that day in Manila', () => {
    expect(parseDay('2026-10-22').toISOString()).toBe('2026-10-21T16:00:00.000Z')
  })

  test('formatDay reads the Manila day, not the UTC one', () => {
    expect(formatDay(new Date('2026-10-21T16:00:00Z'))).toBe('2026-10-22')
    expect(formatDay(new Date('2026-10-22T15:59:59Z'))).toBe('2026-10-22')
  })
})
