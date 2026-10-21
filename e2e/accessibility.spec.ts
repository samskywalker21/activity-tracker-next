import { expect, test } from '@playwright/test'
import { expectAccessible, signIn } from './helpers'

// axe-core over every screen, in light and dark, as the role that can see it. The activity pages
// are checked in `activity-lifecycle.spec.ts`, which creates the activity they show.
const screens = {
  guest: ['/sign-in', '/sign-up', '/calendar'],
  staff: ['/', '/activities', '/activities/new', '/my-activities', '/calendar', '/profile'],
  manager: ['/review', '/manage/participants', '/manage/facilities', '/manage/holidays'],
  admin: ['/admin/profiles', '/admin/divisions', '/admin/sections', '/admin/lgus', '/admin/audit'],
}

for (const colorScheme of ['light', 'dark'] as const) {
  for (const [role, paths] of Object.entries(screens)) {
    for (const path of paths) {
      test(`${path} as ${role}, ${colorScheme}`, async ({ page }) => {
        await page.emulateMedia({ colorScheme })
        if (role !== 'guest') await signIn(page, role)
        await page.goto(path)
        await expect(page.getByRole('heading').first()).toBeVisible()
        await expectAccessible(page)
      })
    }
  }
}
