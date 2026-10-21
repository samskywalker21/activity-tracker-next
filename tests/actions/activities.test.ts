import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import type { ActivityStatus } from '@/generated/prisma/enums'

vi.mock('next/headers', async () => (await import('../next-mocks')).nextHeaders)
vi.mock('next/headers.js', async () => (await import('../next-mocks')).nextHeaders)
vi.mock('next/navigation', async () => (await import('../next-mocks')).nextNavigation)
vi.mock('next/cache', async () => (await import('../next-mocks')).nextCache)

const { changeStatus, checkConflicts, createActivity, updateActivity } = await import(
  '@/actions/activities'
)
const { addComment, deleteComment, updateComment } = await import('@/actions/comments')
const { db } = await import('@/lib/db')
const { createSection, createUser, resetDb, signInAs } = await import('../helpers')

let sectionId: number
const users: Record<'admin' | 'manager' | 'staff' | 'other', string> = {
  admin: '',
  manager: '',
  staff: '',
  other: '',
}

const form = (overrides: Record<string, unknown> = {}) => ({
  title: 'Planning workshop',
  type: 'EVENT',
  virtual: false,
  allDay: false,
  startDate: '2026-10-27',
  startTime: '09:00',
  endDate: '2026-10-27',
  endTime: '17:00',
  sectionId,
  owner: 'Juan Cruz',
  venue: 'Conference room',
  prNo: '',
  otherParticipants: '',
  otherLgu: '',
  otherFacilities: '',
  remarks: '',
  participantIds: [],
  lguIds: [],
  facilityIds: [],
  ...overrides,
})

/** An activity created by `staff`, written straight to the table in the given status. */
function seedActivity(status: ActivityStatus, overrides: Record<string, unknown> = {}) {
  return db.activity.create({
    data: {
      title: 'Seeded',
      type: 'EVENT',
      start: new Date('2026-10-27T01:00:00Z'),
      end: new Date('2026-10-27T09:00:00Z'),
      owner: 'Juan Cruz',
      venue: 'Conference room',
      status,
      sectionId,
      createdById: users.staff,
      updatedById: users.staff,
      ...overrides,
    },
  })
}

beforeAll(async () => {
  await resetDb()
  sectionId = (await createSection()).id
  users.admin = (await createUser({ username: 'admin', role: 'ADMIN', sectionId })).id
  users.manager = (await createUser({ username: 'manager', role: 'MANAGER', sectionId })).id
  users.staff = (await createUser({ username: 'staff', sectionId })).id
  users.other = (await createUser({ username: 'other', sectionId })).id
})

beforeEach(async () => {
  await db.auditLog.deleteMany()
})

describe('createActivity', () => {
  test('creates a PENDING activity with its pivots, a creation event and an audit row', async () => {
    await signInAs('staff')
    const participant = await db.participant.create({ data: { name: 'DILG', isInternal: false } })

    const result = await createActivity(form({ participantIds: [participant.id], prNo: ' ' }))
    if (!result.ok) throw new Error(result.error)

    const activity = await db.activity.findUniqueOrThrow({
      where: { id: result.data.id },
      include: { participants: true, events: true },
    })
    expect(activity).toMatchObject({ status: 'PENDING', createdById: users.staff, prNo: null })
    expect(activity.start.toISOString()).toBe('2026-10-27T01:00:00.000Z') // 09:00 Manila
    expect(activity.participants.map((p) => p.id)).toEqual([participant.id])
    expect(activity.events).toMatchObject([
      { actorId: users.staff, fromStatus: null, toStatus: 'PENDING' },
    ])

    const log = await db.auditLog.findFirstOrThrow({ where: { action: 'activity.create' } })
    expect(log.diff).toMatchObject({
      status: [null, 'PENDING'],
      participantIds: [null, [participant.id]],
    })
  })

  test('all-day activities snap to whole days', async () => {
    await signInAs('staff')
    const result = await createActivity(form({ allDay: true, endDate: '2026-10-28' }))
    if (!result.ok) throw new Error(result.error)

    const activity = await db.activity.findUniqueOrThrow({ where: { id: result.data.id } })
    expect(activity.start.toISOString()).toBe('2026-10-26T16:00:00.000Z')
    expect(activity.end.toISOString()).toBe('2026-10-28T15:59:59.999Z')
  })

  test('refuses an end before the start, on the end field', async () => {
    await signInAs('staff')
    const result = await createActivity(form({ endTime: '08:00' }))
    expect(result).toMatchObject({ ok: false, fieldErrors: { endDate: expect.any(Array) } })
  })

  test('past dates are allowed: activities are often logged after the fact', async () => {
    await signInAs('staff')
    const result = await createActivity(form({ startDate: '2020-01-06', endDate: '2020-01-06' }))
    expect(result.ok).toBe(true)
  })

  test('an inactive section is refused; an activity may keep one it already has', async () => {
    await signInAs('staff')
    const created = await createActivity(form())
    if (!created.ok) throw new Error(created.error)
    const closed = await createSection('OLD')
    await db.section.update({ where: { id: closed.id }, data: { isActive: false } })

    expect(await createActivity(form({ sectionId: closed.id }))).toMatchObject({
      ok: false,
      fieldErrors: { sectionId: ['Choose a section'] },
    })
    expect(await updateActivity(created.data.id, form({ sectionId: closed.id }))).toMatchObject({
      ok: false,
    })

    await db.activity.update({ where: { id: created.data.id }, data: { sectionId: closed.id } })
    expect(await updateActivity(created.data.id, form({ sectionId: closed.id }))).toMatchObject({
      ok: true,
    })
  })
})

describe('updateActivity', () => {
  test('a staff edit sends an approved activity back for review', async () => {
    const activity = await seedActivity('APPROVED')
    await signInAs('staff')

    expect(await updateActivity(activity.id, form({ title: 'Moved workshop' }))).toEqual({
      ok: true,
      data: undefined,
    })

    const updated = await db.activity.findUniqueOrThrow({
      where: { id: activity.id },
      include: { events: true },
    })
    expect(updated.status).toBe('PENDING')
    expect(updated.events).toMatchObject([{ fromStatus: 'APPROVED', toStatus: 'PENDING' }])
  })

  test('an admin edit keeps an approved activity approved and writes no event', async () => {
    const activity = await seedActivity('APPROVED')
    await signInAs('admin')

    await updateActivity(activity.id, form())

    const updated = await db.activity.findUniqueOrThrow({
      where: { id: activity.id },
      include: { events: true },
    })
    expect(updated).toMatchObject({ status: 'APPROVED', updatedById: users.admin })
    expect(updated.events).toEqual([])
  })

  test('editing a returned activity resubmits it', async () => {
    const activity = await seedActivity('RETURNED')
    await signInAs('staff')

    await updateActivity(activity.id, form())

    const events = await db.activityEvent.findMany({ where: { activityId: activity.id } })
    expect(events).toMatchObject([{ fromStatus: 'RETURNED', toStatus: 'PENDING' }])
  })

  test('rejected and cancelled activities, and other people’s, are not editable', async () => {
    const rejected = await seedActivity('REJECTED')
    const cancelled = await seedActivity('CANCELLED')
    const pending = await seedActivity('PENDING')

    await signInAs('admin')
    expect(await updateActivity(rejected.id, form())).toMatchObject({ ok: false })
    expect(await updateActivity(cancelled.id, form())).toMatchObject({ ok: false })

    await signInAs('other')
    expect(await updateActivity(pending.id, form())).toMatchObject({ ok: false })
    await signInAs('manager')
    expect(await updateActivity(pending.id, form())).toMatchObject({ ok: false })

    expect(await db.auditLog.count()).toBe(0)
  })

  test('replaces the pivots and records them as id lists', async () => {
    const [a, b] = await db.facility.createManyAndReturn({
      data: [{ name: 'Hall' }, { name: 'Van' }],
    })
    const activity = await seedActivity('PENDING', { facilities: { connect: [{ id: a.id }] } })
    await signInAs('staff')

    await updateActivity(activity.id, form({ facilityIds: [b.id] }))

    const updated = await db.activity.findUniqueOrThrow({
      where: { id: activity.id },
      include: { facilities: true },
    })
    expect(updated.facilities.map((f) => f.id)).toEqual([b.id])
    const log = await db.auditLog.findFirstOrThrow({ where: { action: 'activity.update' } })
    expect(log.diff).toMatchObject({ facilityIds: [[a.id], [b.id]] })
  })
})

describe('changeStatus', () => {
  // The rules table, through the action: [actor, from, allowed decisions].
  const table: [keyof typeof users, ActivityStatus, ActivityStatus[]][] = [
    ['staff', 'PENDING', ['CANCELLED']],
    ['staff', 'RETURNED', ['CANCELLED']],
    ['staff', 'APPROVED', []],
    ['other', 'PENDING', []],
    ['other', 'RETURNED', []],
    ['manager', 'PENDING', ['APPROVED', 'RETURNED', 'REJECTED']],
    ['manager', 'RETURNED', []],
    ['manager', 'APPROVED', []],
    ['admin', 'PENDING', ['APPROVED', 'RETURNED', 'REJECTED', 'CANCELLED']],
    ['admin', 'RETURNED', ['CANCELLED']],
    ['admin', 'APPROVED', ['CANCELLED']],
  ]
  const terminal: ActivityStatus[] = ['REJECTED', 'CANCELLED']
  const decisions = ['APPROVED', 'RETURNED', 'REJECTED', 'CANCELLED'] as const

  test.each(table)('%s on a %s activity may make exactly %o', async (actor, from, allowed) => {
    await signInAs(actor)
    for (const status of decisions) {
      const activity = await seedActivity(from)
      const result = await changeStatus(activity.id, { status, note: 'Because' })
      expect(result.ok, `${status}`).toBe(allowed.includes(status))
    }
  })

  test.each(terminal)('nobody changes a %s activity', async (from) => {
    for (const actor of ['staff', 'manager', 'admin'] as const) {
      await signInAs(actor)
      for (const status of decisions) {
        const activity = await seedActivity(from)
        expect((await changeStatus(activity.id, { status, note: 'Because' })).ok).toBe(false)
      }
    }
  })

  test('reviewing a non-pending activity says why', async () => {
    const activity = await seedActivity('APPROVED')
    await signInAs('manager')
    expect(await changeStatus(activity.id, { status: 'REJECTED', note: 'No' })).toEqual({
      ok: false,
      error: 'Only a pending activity can be reviewed',
    })
  })

  test('returning, rejecting and cancelling need a reason; approving does not', async () => {
    const activity = await seedActivity('PENDING')
    await signInAs('admin')
    for (const status of ['RETURNED', 'REJECTED', 'CANCELLED'] as const) {
      expect(await changeStatus(activity.id, { status, note: ' ' })).toMatchObject({
        ok: false,
        fieldErrors: { note: ['Give a reason'] },
      })
    }
    expect((await changeStatus(activity.id, { status: 'APPROVED', note: '' })).ok).toBe(true)
  })

  test('writes the event with its note and the audit row together', async () => {
    const activity = await seedActivity('PENDING')
    await signInAs('manager')

    await changeStatus(activity.id, { status: 'RETURNED', note: 'Add the venue' })

    expect(await db.activityEvent.findMany({ where: { activityId: activity.id } })).toMatchObject([
      {
        actorId: users.manager,
        fromStatus: 'PENDING',
        toStatus: 'RETURNED',
        note: 'Add the venue',
      },
    ])
    expect(await db.auditLog.findMany()).toMatchObject([
      {
        action: 'activity.status',
        entityId: String(activity.id),
        diff: { status: ['PENDING', 'RETURNED'] },
        meta: { note: 'Add the venue' },
      },
    ])
  })
})

describe('checkConflicts', () => {
  test('buckets overlapping activities by what they share; unselected buckets are empty', async () => {
    await db.comment.deleteMany()
    await db.activityEvent.deleteMany()
    await db.activity.deleteMany()
    await db.holiday.deleteMany({})
    const participant = await db.participant.create({ data: { name: 'Mayor', isInternal: false } })
    const lgu = await db.lgu.create({
      data: {
        id: '104305000',
        provinceId: 104300000,
        province: 'Misamis Oriental',
        muncity: 'Balingasag',
      },
    })

    // 09:00–17:00 Manila on Oct 27 is 01:00–09:00 UTC.
    const sharing = await seedActivity('PENDING', {
      participants: { connect: [{ id: participant.id }] },
      lgus: { connect: [{ id: lgu.id }] },
    })
    const sameTime = await seedActivity('APPROVED')
    const editing = await seedActivity('PENDING', {
      participants: { connect: [{ id: participant.id }] },
    })
    await seedActivity('REJECTED') // never a clash
    await seedActivity('PENDING', {
      start: new Date('2026-10-27T09:00:01Z'),
      end: new Date('2026-10-27T10:00:00Z'),
    }) // starts just after
    await db.holiday.create({
      data: {
        name: 'Founding day',
        start: new Date('2026-10-26T16:00:00Z'),
        end: new Date('2026-10-27T15:59:59.999Z'),
      },
    })

    await signInAs('staff')
    const result = await checkConflicts({
      ...form(),
      id: editing.id,
      participantIds: [participant.id],
    })
    if (!result.ok) throw new Error(result.error)

    const ids = (rows: { id: number }[]) => rows.map((row) => row.id).sort()
    expect(ids(result.data.date)).toEqual([sharing.id, sameTime.id].sort())
    expect(ids(result.data.participants)).toEqual([sharing.id])
    // The activity shares an LGU too, but no LGU was selected.
    expect(result.data.lgus).toEqual([])
    expect(result.data.facilities).toEqual([])
    expect(result.data.holidays.map((h) => h.name)).toEqual(['Founding day'])
  })
})

describe('comments', () => {
  test('anyone adds; only the author edits or deletes', async () => {
    const activity = await seedActivity('PENDING')
    await signInAs('other')
    expect((await addComment(activity.id, { body: '  Who is coming?  ' })).ok).toBe(true)
    const comment = await db.comment.findFirstOrThrow({ where: { activityId: activity.id } })
    expect(comment).toMatchObject({ body: 'Who is coming?', authorId: users.other })
    expect(await db.auditLog.count({ where: { action: 'comment.create' } })).toBe(1)

    await signInAs('admin')
    expect((await updateComment(comment.id, { body: 'Changed' })).ok).toBe(false)
    expect((await deleteComment(comment.id)).ok).toBe(false)

    // signInAs clears the audit log.
    await signInAs('other')
    expect((await updateComment(comment.id, { body: 'Who is driving?' })).ok).toBe(true)
    expect((await deleteComment(comment.id)).ok).toBe(true)
    expect(await db.comment.count({ where: { activityId: activity.id } })).toBe(0)

    expect((await db.auditLog.findMany({ orderBy: { id: 'asc' } })).map((l) => l.action)).toEqual([
      'comment.update',
      'comment.delete',
    ])
  })

  test('an empty comment is refused', async () => {
    const activity = await seedActivity('PENDING')
    await signInAs('staff')
    expect(await addComment(activity.id, { body: '   ' })).toMatchObject({
      ok: false,
      fieldErrors: { body: ['Write a comment'] },
    })
  })
})
