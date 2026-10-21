import { expect, test } from '@playwright/test'
import { signIn } from './helpers'

// At phone width nothing should scroll sideways; wide tables scroll inside their own box.
test.use({ viewport: { width: 390, height: 844 } })

const screens = [
  '/',
  '/activities',
  '/activities/new',
  '/my-activities',
  '/review',
  '/calendar',
  '/profile',
  '/manage/participants',
  '/manage/facilities',
  '/manage/holidays',
  '/admin/profiles',
  '/admin/divisions',
  '/admin/sections',
  '/admin/lgus',
  '/admin/audit',
]

test('no screen scrolls sideways on a phone', async ({ page }) => {
  await signIn(page, 'admin')
  for (const path of screens) {
    await test.step(path, async () => {
      await page.goto(path)
      await page.waitForLoadState('networkidle')
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      )
      expect(overflow).toBe(0)
    })
  }
})
