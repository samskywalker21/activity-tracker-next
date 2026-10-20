import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'

vi.mock('next/headers', async () => (await import('../next-mocks')).nextHeaders)
vi.mock('next/headers.js', async () => (await import('../next-mocks')).nextHeaders)
vi.mock('next/navigation', async () => (await import('../next-mocks')).nextNavigation)
vi.mock('next/cache', async () => (await import('../next-mocks')).nextCache)

const { createDivision, setDivisionActive, updateDivision } = await import('@/actions/divisions')
const { createSection: createSectionAction, updateSection } = await import('@/actions/sections')
const { createLgu, updateLgu } = await import('@/actions/lgus')
const { createParticipant, setParticipantActive, updateParticipant } = await import(
  '@/actions/participants'
)
const { createFacility } = await import('@/actions/facilities')
const { createHoliday, deleteHoliday, updateHoliday } = await import('@/actions/holidays')
const { db } = await import('@/lib/db')
const { createSection, createUser, resetDb, signInAs } = await import('../helpers')

beforeAll(async () => {
  await resetDb()
  const sectionId = (await createSection()).id
  await createUser({ username: 'admin', role: 'ADMIN', sectionId })
  await createUser({ username: 'manager', role: 'MANAGER', sectionId })
  await createUser({ username: 'staff', sectionId })
  await db.lgu.create({
    data: {
      id: '104305000',
      provinceId: 104300000,
      province: 'Misamis Oriental',
      muncity: 'Balingasag',
    },
  })
})

beforeEach(async () => {
  await db.auditLog.deleteMany()
})

describe('permissions', () => {
  test('staff cannot manage participants, facilities or holidays', async () => {
    await signInAs('staff')
    await expect(createParticipant({ name: 'NGOs', isInternal: false })).rejects.toThrow(
      'permission'
    )
    await expect(createFacility({ name: 'Rural Health Unit' })).rejects.toThrow('permission')
    await expect(
      createHoliday({ name: 'All Saints', start: '2026-11-01', end: '2026-11-01' })
    ).rejects.toThrow('permission')
  })

  test('managers manage participants but not divisions, sections or LGUs', async () => {
    await signInAs('manager')
    expect(await createParticipant({ name: 'Barangay Health Workers', isInternal: false })).toEqual(
      { ok: true, data: undefined }
    )
    await expect(createDivision({ code: 'NEW', name: 'New Division' })).rejects.toThrow(
      'permission'
    )
    await expect(
      createSectionAction({ code: 'NEW', name: 'New Section', divisionId: 1 })
    ).rejects.toThrow('permission')
    await expect(
      createLgu({ id: '104306000', muncity: 'Balingoan', provinceId: 104300000 })
    ).rejects.toThrow('permission')
  })
})

describe('participants', () => {
  test('create, update and deactivate are each audited with a diff', async () => {
    await signInAs('manager')
    await createParticipant({ name: 'Provincial Health Office', isInternal: false })
    const participant = await db.participant.findFirstOrThrow({
      where: { name: 'Provincial Health Office' },
    })

    await updateParticipant(participant.id, { name: 'Provincial Health Office', isInternal: true })
    await setParticipantActive(participant.id, false)

    const rows = await db.auditLog.findMany({ orderBy: { id: 'asc' } })
    expect(rows).toMatchObject([
      {
        action: 'participant.create',
        entityType: 'Participant',
        entityId: String(participant.id),
        diff: { name: [null, 'Provincial Health Office'], isInternal: [null, false] },
      },
      { action: 'participant.update', diff: { isInternal: [false, true] } },
      { action: 'participant.set_active', diff: { isActive: [true, false] } },
    ])
    expect(await db.participant.findUnique({ where: { id: participant.id } })).toMatchObject({
      isInternal: true,
      isActive: false,
    })
  })

  test('a short name is refused per field', async () => {
    await signInAs('manager')
    expect(await createParticipant({ name: 'AB', isInternal: true })).toMatchObject({
      ok: false,
      fieldErrors: { name: ['Name must be at least 3 characters'] },
    })
  })
})

describe('holidays', () => {
  test('are stored as whole days in Manila', async () => {
    await signInAs('manager')
    await createHoliday({ name: 'Bonifacio Day', start: '2026-11-30', end: '2026-11-30' })
    expect(await db.holiday.findFirstOrThrow({ where: { name: 'Bonifacio Day' } })).toMatchObject({
      start: new Date('2026-11-29T16:00:00.000Z'),
      end: new Date('2026-11-30T15:59:59.999Z'),
    })
  })

  test('the end cannot precede the start', async () => {
    await signInAs('manager')
    expect(
      await createHoliday({ name: 'Backwards', start: '2026-12-25', end: '2026-12-24' })
    ).toMatchObject({
      ok: false,
      fieldErrors: { end: ['End date cannot be before the start date'] },
    })
  })

  test('a delete removes it and audits what it was', async () => {
    await signInAs('manager')
    await createHoliday({ name: 'Rizal Day', start: '2026-12-30', end: '2026-12-30' })
    const holiday = await db.holiday.findFirstOrThrow({ where: { name: 'Rizal Day' } })

    expect(await deleteHoliday(holiday.id)).toEqual({ ok: true, data: undefined })
    expect(await db.holiday.findUnique({ where: { id: holiday.id } })).toBeNull()
    expect(await db.auditLog.findFirst({ where: { action: 'holiday.delete' } })).toMatchObject({
      entityId: String(holiday.id),
      diff: { name: ['Rizal Day', null] },
    })
  })

  test('staff cannot delete a holiday', async () => {
    await signInAs('staff')
    await expect(deleteHoliday(1)).rejects.toThrow('permission')
  })

  test('an update re-snaps the days', async () => {
    await signInAs('manager')
    await createHoliday({ name: 'Christmas', start: '2026-12-25', end: '2026-12-25' })
    const holiday = await db.holiday.findFirstOrThrow({ where: { name: 'Christmas' } })
    await updateHoliday(holiday.id, { name: 'Christmas', start: '2026-12-24', end: '2026-12-25' })
    expect(await db.holiday.findUnique({ where: { id: holiday.id } })).toMatchObject({
      start: new Date('2026-12-23T16:00:00.000Z'),
      end: new Date('2026-12-25T15:59:59.999Z'),
    })
  })
})

describe('divisions and sections', () => {
  test('codes are upper-cased and must be unique', async () => {
    await signInAs('admin')
    expect(await createDivision({ code: 'qa', name: 'Quality Assurance' })).toMatchObject({
      ok: true,
    })
    expect(await createDivision({ code: 'QA', name: 'Another' })).toMatchObject({
      ok: false,
      fieldErrors: { code: ['That code is already in use'] },
    })

    const division = await db.division.findUniqueOrThrow({ where: { code: 'QA' } })
    expect(await updateDivision(division.id, { code: 'QA', name: 'Quality Office' })).toMatchObject(
      {
        ok: true,
      }
    )
  })

  test('a section cannot be moved to an inactive division', async () => {
    await signInAs('admin')
    await createDivision({ code: 'OLD', name: 'Old Division' })
    const old = await db.division.findUniqueOrThrow({ where: { code: 'OLD' } })
    await setDivisionActive(old.id, false)

    const section = await db.section.findFirstOrThrow()
    expect(
      await updateSection(section.id, {
        code: section.code,
        name: section.name,
        divisionId: old.id,
      })
    ).toMatchObject({ ok: false, fieldErrors: { divisionId: ['Choose a division'] } })
  })
})

describe('LGUs', () => {
  test('take the province name from an existing LGU of that province', async () => {
    await signInAs('admin')
    await createLgu({ id: '104306000', muncity: 'Balingoan', provinceId: 104300000 })
    expect(await db.lgu.findUnique({ where: { id: '104306000' } })).toMatchObject({
      province: 'Misamis Oriental',
    })
    expect(
      await createLgu({ id: '999999999', muncity: 'Nowhere', provinceId: 999999999 })
    ).toMatchObject({ ok: false, fieldErrors: { provinceId: ['Choose a province'] } })
  })

  test('a PSGC code cannot be added twice', async () => {
    await signInAs('admin')
    expect(
      await createLgu({ id: '104305000', muncity: 'Balingasag', provinceId: 104300000 })
    ).toMatchObject({
      ok: false,
      fieldErrors: { id: ['An LGU with that PSGC code already exists'] },
    })
    expect(
      await updateLgu('104305000', { muncity: 'Balingasag Town', provinceId: 104300000 })
    ).toMatchObject({ ok: true })
  })
})
