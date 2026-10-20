import { expect, test } from '@playwright/test'

test('a guest is sent to sign-in', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/sign-in$/)
  await expect(page.getByText('Sign in', { exact: true }).first()).toBeVisible()
})

test('a guest can open the calendar', async ({ page }) => {
  await page.goto('/calendar')
  await expect(page).toHaveURL(/\/calendar$/)
  await expect(page.getByRole('heading', { name: 'Activity Calendar' })).toBeVisible()
  await expect(page.locator('.sx__month-grid-wrapper, .sx__month-agenda-wrapper')).toBeVisible()
})
