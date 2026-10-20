import { expect, test } from '@playwright/test'

test('a guest is sent to sign-in', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/sign-in$/)
  await expect(page.getByText('Sign in', { exact: true }).first()).toBeVisible()
})
