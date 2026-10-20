import { describe, expect, test } from 'vitest'
import type { ActivityStatus } from '@/generated/prisma/enums'
import { allowedTransitions, canEdit, statusAfterEdit } from '@/lib/rules'

const creator = { id: 'creator', role: 'STAFF' as const }
const otherStaff = { id: 'other', role: 'STAFF' as const }
const manager = { id: 'manager', role: 'MANAGER' as const }
const admin = { id: 'admin', role: 'ADMIN' as const }

const activity = (status: ActivityStatus) => ({ createdById: 'creator', status })

// Every status × actor: what the status dialog may offer.
describe('allowedTransitions', () => {
  test.each([
    ['PENDING', creator, ['CANCELLED']],
    ['PENDING', otherStaff, []],
    ['PENDING', manager, ['APPROVED', 'RETURNED', 'REJECTED']],
    ['PENDING', admin, ['APPROVED', 'RETURNED', 'REJECTED', 'CANCELLED']],
    ['RETURNED', creator, ['CANCELLED']],
    ['RETURNED', otherStaff, []],
    ['RETURNED', manager, []],
    ['RETURNED', admin, ['CANCELLED']],
    ['APPROVED', creator, []],
    ['APPROVED', otherStaff, []],
    ['APPROVED', manager, []],
    ['APPROVED', admin, ['CANCELLED']],
    ['REJECTED', creator, []],
    ['REJECTED', manager, []],
    ['REJECTED', admin, []],
    ['CANCELLED', creator, []],
    ['CANCELLED', manager, []],
    ['CANCELLED', admin, []],
  ] as const)('%s for %o → %o', (status, user, expected) => {
    expect(allowedTransitions(user, activity(status))).toEqual(expected)
  })

  test('a manager reviews their own pending activity and may cancel it as its creator', () => {
    expect(allowedTransitions(manager, { createdById: 'manager', status: 'PENDING' })).toEqual([
      'APPROVED',
      'RETURNED',
      'REJECTED',
      'CANCELLED',
    ])
  })
})

describe('canEdit', () => {
  test.each([
    ['PENDING', true],
    ['RETURNED', true],
    ['APPROVED', true],
    ['REJECTED', false],
    ['CANCELLED', false],
  ] as const)('creator, %s → %s', (status, expected) => {
    expect(canEdit(creator, activity(status))).toBe(expected)
  })

  test('admins edit anyone’s; other staff and managers do not', () => {
    expect(canEdit(admin, activity('APPROVED'))).toBe(true)
    expect(canEdit(admin, activity('REJECTED'))).toBe(false)
    expect(canEdit(otherStaff, activity('PENDING'))).toBe(false)
    expect(canEdit(manager, activity('PENDING'))).toBe(false)
  })
})

describe('statusAfterEdit', () => {
  test('a returned activity is resubmitted', () => {
    expect(statusAfterEdit(creator, activity('RETURNED'))).toBe('PENDING')
    expect(statusAfterEdit(admin, activity('RETURNED'))).toBe('PENDING')
  })

  test('a non-admin edit re-pends an approved activity; an admin edit keeps it approved', () => {
    expect(statusAfterEdit(creator, activity('APPROVED'))).toBe('PENDING')
    expect(statusAfterEdit(admin, activity('APPROVED'))).toBe('APPROVED')
  })

  test('a pending activity stays pending', () => {
    expect(statusAfterEdit(creator, activity('PENDING'))).toBe('PENDING')
  })
})
