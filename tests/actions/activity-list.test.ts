import { beforeAll, describe, expect, test, vi } from 'vitest'

vi.mock('next/headers', async () => (await import('../next-mocks')).nextHeaders)
vi.mock('next/headers.js', async () => (await import('../next-mocks')).nextHeaders)
vi.mock('next/navigation', async () => (await import('../next-mocks')).nextNavigation)
vi.mock('next/cache', async () => (await import('../next-mocks')).nextCache)

const { exportActivities } = await import('@/actions/activities')
const { activityWhere, loadActivityFilters } = await import('@/lib/activity-list')
const { db } = await import('@/lib/db')
const { createSection, createUser, resetDb, signInAs } = await import('../helpers')

let ids: Record<'workshop' | 'monitoring' | 'webinar', number>
let staffId: string

beforeAll(async () => {
  await resetDb()
  const ictu = await createSection('ICTU')
  const hems = await createSection('HEMS')
  staffId = (await createUser({ username: 'staff', sectionId: ictu.id })).id
  const otherId = (await createUser({ username: 'other', sectionId: hems.id })).id
  const participant = await db.participant.create({
    data: { name: 'Mayor "Jun"', isInternal: false },
  })

  const base = { owner: 'Juan Cruz', venue: 'Hall', updatedById: staffId }
  const workshop = await db.activity.create({
    data: {
      ...base,
      title: 'Planning workshop',
      type: 'EVENT',
      start: new Date('2026-10-27T01:00:00Z'), // 09:00 Manila
      end: new Date('2026-10-27T09:00:00Z'),
      sectionId: ictu.id,
      createdById: staffId,
      participants: { connect: [{ id: participant.id }] },
    },
  })
  const monitoring = await db.activity.create({
    data: {
      ...base,
      title: 'Dengue monitoring',
      type: 'MONITORING',
      status: 'APPROVED',
      start: new Date('2026-10-28T16:30:00Z'), // Oct 29, 00:30 Manila
      end: new Date('2026-10-29T08:00:00Z'),
      sectionId: hems.id,
      createdById: otherId,
    },
  })
  const webinar = await db.activity.create({
    data: {
      ...base,
      title: 'Data webinar',
      type: 'EVENT',
      virtual: true,
      venue: 'Zoom',
      start: new Date('2026-10-20T01:00:00Z'),
      end: new Date('2026-10-20T03:00:00Z'),
      sectionId: ictu.id,
      createdById: staffId,
    },
  })
  ids = { workshop: workshop.id, monitoring: monitoring.id, webinar: webinar.id }
})

const find = async (query: string) => {
  const rows = await db.activity.findMany({
    where: activityWhere(await loadActivityFilters(query)),
    select: { id: true },
  })
  return rows.map((row) => row.id).sort()
}

describe('activityWhere', () => {
  test('searches the title, venue, creator, section and division', async () => {
    expect(await find('q=dengue')).toEqual([ids.monitoring])
    expect(await find('q=zoom')).toEqual([ids.webinar])
    expect(await find('q=test%20other')).toEqual([ids.monitoring])
    expect(await find('q=hems')).toEqual([ids.monitoring])
    expect(await find('q=D-ICTU')).toEqual([ids.workshop, ids.webinar].sort())
  })

  test('filters by status, type, format and creator', async () => {
    expect(await find('status=APPROVED')).toEqual([ids.monitoring])
    expect(await find('type=EVENT&virtual=no')).toEqual([ids.workshop])
    expect(await find(`createdBy=${staffId}`)).toEqual([ids.workshop, ids.webinar].sort())
  })

  test('bounds the start by whole Manila days', async () => {
    // Starts at 00:30 on Oct 29 in Manila, still Oct 28 in UTC.
    expect(await find('from=2026-10-29&to=2026-10-29')).toEqual([ids.monitoring])
    expect(await find('from=2026-10-21')).toEqual([ids.workshop, ids.monitoring].sort())
    expect(await find('to=2026-10-27')).toEqual([ids.workshop, ids.webinar].sort())
  })

  test('ignores values that are not valid', async () => {
    expect(await find('status=NOPE&from=yesterday')).toHaveLength(3)
  })
})

describe('exportActivities', () => {
  test('every match, ordered by start, with labels, local times and joined pivots', async () => {
    await signInAs('staff')
    const result = await exportActivities('type=EVENT')
    if (!result.ok) throw new Error(result.error)

    const lines = result.data.trimEnd().split('\r\n')
    expect(lines[0]).toMatch(/^"ID","Title","Type","Status","Start","End",/)
    expect(lines).toHaveLength(3)
    expect(lines[1]).toContain('"Data webinar","Event","Pending"')
    expect(lines[2]).toContain('"2026-10-27 09:00","2026-10-27 17:00"')
    expect(lines[2]).toContain('"Mayor ""Jun"""')
    expect(lines[2]).toContain('"Test staff"')
  })
})
