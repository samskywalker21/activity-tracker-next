import { describe, expect, test } from 'vitest'
import { authHref, safeNextPath } from '@/lib/next-path'

describe('safeNextPath', () => {
  test('keeps a path on this site, with its query', () => {
    expect(safeNextPath('/activities/12')).toBe('/activities/12')
    expect(safeNextPath('/review?status=PENDING')).toBe('/review?status=PENDING')
  })

  test('falls back to the dashboard for anything else', () => {
    for (const next of [
      undefined,
      '',
      ['/a'],
      'activities',
      'https://evil.example',
      '//evil.example',
      '/\\evil.example',
    ]) {
      expect(safeNextPath(next)).toBe('/')
    }
  })
})

describe('authHref', () => {
  test('carries next unless it is the dashboard', () => {
    expect(authHref('/sign-in', '/')).toBe('/sign-in')
    expect(authHref('/sign-up', '/review?status=PENDING')).toBe(
      '/sign-up?next=%2Freview%3Fstatus%3DPENDING'
    )
  })
})
