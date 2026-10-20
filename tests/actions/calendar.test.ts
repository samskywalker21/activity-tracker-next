import { beforeAll, describe, expect, test, vi } from 'vitest'

vi.mock('next/headers', async () => (await import('../next-mocks')).nextHeaders)
vi.mock('next/headers.js', async () => (await import('../next-mocks')).nextHeaders)
vi.mock('next/navigation', async () => (await import('../next-mocks')).nextNavigation)
vi.mock('next/cache', async () => (await import('../next-mocks')).nextCache)

const { getCalendarRange } = await import('@/actions/calendar')
const { db } = await import('@/lib/db')
const { createSection, createUser, resetDb } = await import('../helpers')

let sections: Record<'ictu' | 'hems', { id: number; divisionId: number }>

// October 2026 as the month grid asks for it, in Manila.
const october = {
  start: new Date('2026-09-26T16:00:00Z'),
  end: new Date('2026-10-31T15:59:59Z'),
}

beforeAll(async () => {
  await resetDb()
  sections = { ictu: await createSection('ICTU'), hems: await createSection('HEMS') }
  const userId = (await createUser({ username: 'staff', sectionId: sections.ictu.id })).id

  const base = {
    owner: 'Juan Cruz',
    venue: 'Hall',
    type: 'EVENT',
    createdById: userId,
    updatedById: userId,
  } as const
  await db.activity.createMany({
    data: [
      {
        ...base,
        title: 'Planning workshop',
        status: 'APPROVED',
        sectionId: sections.ictu.id,
        start: new Date('2026-10-27T01:00:00Z'), // 09:00 Manila
        end: new Date('2026-10-27T09:00:00Z'),
      },
      {
        ...base,
        title: 'Month-end monitoring',
        type: 'MONITORING',
        sectionId: sections.hems.id,
        // Runs into November: overlapping is enough.
        start: new Date('2026-10-30T01:00:00Z'),
        end: new Date('2026-11-02T09:00:00Z'),
      },
      {
        ...base,
        title: 'Returned item',
        status: 'RETURNED',
        sectionId: sections.ictu.id,
        start: new Date('2026-10-20T01:00:00Z'),
        end: new Date('2026-10-20T09:00:00Z'),
      },
      {
        ...base,
        title: 'December retreat',
        sectionId: sections.ictu.id,
        start: new Date('2026-12-01T01:00:00Z'),
        end: new Date('2026-12-02T09:00:00Z'),
      },
    ],
  })
})

const titles = async (input: Parameters<typeof getCalendarRange>[0]) => {
  const result = await getCalendarRange(input)
  if (!result.ok) throw new Error(result.error)
  return result.data.map((activity) => activity.title)
}

describe('getCalendarRange', () => {
  test('approved and pending activities overlapping the window, for guests too', async () => {
    expect(await titles(october)).toEqual(['Planning workshop', 'Month-end monitoring'])
  })

  test('filters by status, type, section and division', async () => {
    expect(await titles({ ...october, status: 'PENDING' })).toEqual(['Month-end monitoring'])
    expect(await titles({ ...october, type: 'EVENT' })).toEqual(['Planning workshop'])
    expect(await titles({ ...october, section: sections.ictu.id })).toEqual(['Planning workshop'])
    expect(await titles({ ...october, division: sections.hems.divisionId })).toEqual([
      'Month-end monitoring',
    ])
  })

  test('formats the days and times in Manila', async () => {
    const result = await getCalendarRange(october)
    if (!result.ok) throw new Error(result.error)
    expect(result.data[0]).toMatchObject({
      section: 'ICTU',
      startDay: '2026-10-27',
      endDay: '2026-10-27',
      when: expect.stringContaining('9:00 AM'),
    })
  })

  test('refuses a status the calendar does not show', async () => {
    // @ts-expect-error: not one of the calendar's statuses
    const result = await getCalendarRange({ ...october, status: 'RETURNED' })
    expect(result.ok).toBe(false)
  })
})
