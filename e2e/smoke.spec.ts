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

test('sign-in returns a guest to the page they asked for', async ({ page }) => {
  await page.goto('/activities?q=x')
  await expect(page).toHaveURL('/sign-in?next=%2Factivities%3Fq%3Dx')
  await page.getByLabel('Username').fill('staff')
  await page.getByLabel('Password', { exact: true }).fill('staff')
  await page.getByRole('button', { name: 'Show password' }).click()
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'text')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL('/activities?q=x')
})

test('a guest can sign up, picking their section by search', async ({ page }) => {
  await page.goto('/sign-up')
  await page.getByLabel('First name').fill('Maria')
  await page.getByLabel('Last name').fill('Santos')
  await page.getByLabel('Position').fill('Nurse II')
  await page.getByLabel('Section', { exact: true }).fill('ictu')
  await page.getByRole('option', { name: /Information and Communication Technology Unit/ }).click()
  await page.getByLabel('Username').fill(`maria.${Date.now()}`)
  await page.getByLabel('Password', { exact: true }).fill('maria')
  await page.getByLabel('Confirm password').fill('maria')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page).toHaveURL('/')
})
