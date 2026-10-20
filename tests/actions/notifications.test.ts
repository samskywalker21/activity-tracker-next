import { beforeAll, describe, expect, test, vi } from 'vitest'

vi.mock('next/headers', async () => (await import('../next-mocks')).nextHeaders)
vi.mock('next/headers.js', async () => (await import('../next-mocks')).nextHeaders)
vi.mock('next/navigation', async () => (await import('../next-mocks')).nextNavigation)
vi.mock('next/cache', async () => (await import('../next-mocks')).nextCache)

const { getNotifications, getUnreadCount, markNotificationsSeen } = await import(
  '@/actions/notifications'
)
const { db } = await import('@/lib/db')
const { createSection, createUser, resetDb, signInAs } = await import('../helpers')

const ids = { staff: '', other: '', manager: '', admin: '' }
const longAgo = new Date('2020-01-01T00:00:00Z')

beforeAll(async () => {
  await resetDb()
  const { id: sectionId } = await createSection()
  ids.staff = (await createUser({ username: 'staff', sectionId })).id
  ids.other = (await createUser({ username: 'other', sectionId })).id
  ids.manager = (await createUser({ username: 'manager', role: 'MANAGER', sectionId })).id
  ids.admin = (await createUser({ username: 'admin', role: 'ADMIN', sectionId })).id
  // Everything below counts as unread.
  await db.user.updateMany({ data: { notificationsSeenAt: longAgo } })

  const activity = (title: string, createdById: string, status: 'PENDING' | 'RETURNED') =>
    db.activity.create({
      data: {
        title,
        status,
        type: 'EVENT',
        owner: 'Owner',
        venue: 'Hall',
        start: new Date('2026-10-27T01:00:00Z'),
        end: new Date('2026-10-27T09:00:00Z'),
        sectionId,
        createdById,
        updatedById: createdById,
      },
    })
  const returned = await activity('Returned workshop', ids.staff, 'RETURNED')
  const pending = await activity('Pending training', ids.staff, 'PENDING')
  const managers = await activity("Manager's meeting", ids.manager, 'PENDING')

  await db.activityEvent.createMany({
    data: [
      { activityId: returned.id, actorId: ids.staff, toStatus: 'PENDING' },
      {
        activityId: returned.id,
        actorId: ids.manager,
        fromStatus: 'PENDING',
        toStatus: 'RETURNED',
        note: 'Add the venue',
      },
      { activityId: pending.id, actorId: ids.staff, toStatus: 'PENDING' },
      { activityId: managers.id, actorId: ids.manager, toStatus: 'PENDING' },
      // The manager is both its creator and a reviewer told of cancellations: still one item.
      {
        activityId: managers.id,
        actorId: ids.admin,
        fromStatus: 'PENDING',
        toStatus: 'CANCELLED',
        note: 'Duplicate',
      },
    ],
  })
  await db.comment.createMany({
    data: [
      { activityId: returned.id, authorId: ids.other, body: 'On a returned one' },
      { activityId: pending.id, authorId: ids.other, body: 'On a pending one' },
      { activityId: pending.id, authorId: ids.staff, body: 'My own comment' },
    ],
  })
})

const summary = async (username: string) => {
  await signInAs(username)
  const result = await getNotifications()
  if (!result.ok) throw new Error(result.error)
  return result.data
    .map((n) => `${n.actor.replace('Test ', '')} ${n.verb} ${n.activityTitle}`)
    .sort()
}

describe('notifications', () => {
  test('a creator hears of status changes and comments by others, not their own', async () => {
    expect(await summary('staff')).toEqual([
      'manager returned Returned workshop',
      'other commented on Pending training',
      'other commented on Returned workshop',
    ])
  })

  test('a reviewer also hears of submissions, cancellations and comments on pending ones', async () => {
    expect(await summary('manager')).toEqual([
      "admin cancelled Manager's meeting",
      'other commented on Pending training',
      'staff commented on Pending training',
      'staff submitted Pending training',
      'staff submitted Returned workshop',
    ])
  })

  test('someone who neither filed nor reviews hears nothing', async () => {
    expect(await summary('other')).toEqual([])
  })

  test('marking seen resets the unread count; newer items count again', async () => {
    await signInAs('staff')
    expect(await getUnreadCount()).toMatchObject({ ok: true, data: { count: 3 } })

    await markNotificationsSeen()
    expect(await getUnreadCount()).toMatchObject({ ok: true, data: { count: 0 } })

    const activity = await db.activity.findFirstOrThrow({ where: { title: 'Pending training' } })
    await db.comment.create({
      data: { activityId: activity.id, authorId: ids.manager, body: 'Looks good' },
    })
    expect(await getUnreadCount()).toMatchObject({ ok: true, data: { count: 1 } })
  })
})
