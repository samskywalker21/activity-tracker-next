import { describe, expect, test } from 'vitest'
import { diff } from '@/lib/audit'

describe('diff', () => {
  test('lists only the fields that changed, as [before, after]', () => {
    expect(diff({ title: 'Old', venue: 'Hall' }, { title: 'New', venue: 'Hall' })).toEqual({
      title: ['Old', 'New'],
    })
  })

  test('ignores fields missing from after', () => {
    expect(diff({ title: 'Same', remarks: 'x' }, { title: 'Same' })).toEqual({})
  })

  test('compares dates by instant and stores them as ISO strings', () => {
    const start = new Date('2026-10-20T00:00:00Z')
    expect(diff({ start }, { start: new Date(start) })).toEqual({})
    expect(diff({ start }, { start: new Date('2026-10-21T00:00:00Z') })).toEqual({
      start: ['2026-10-20T00:00:00.000Z', '2026-10-21T00:00:00.000Z'],
    })
  })

  test('compares id lists regardless of order and stores them sorted', () => {
    expect(diff({ lguIds: [3, 1, 2] }, { lguIds: [1, 2, 3] })).toEqual({})
    expect(diff({ participantIds: [10, 2] }, { participantIds: [2, 10, 4] })).toEqual({
      participantIds: [
        [2, 10],
        [2, 4, 10],
      ],
    })
  })

  test('treats undefined and null as the same', () => {
    expect(diff({ prNo: null }, { prNo: undefined })).toEqual({})
    expect(diff({}, { prNo: 'PR-1' })).toEqual({ prNo: [null, 'PR-1'] })
  })
})
