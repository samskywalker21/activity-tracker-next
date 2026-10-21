import AxeBuilder from '@axe-core/playwright'
import { expect, type Page } from '@playwright/test'

/** Signs in as one of the seeded users, whose password is their username. */
export async function signIn(page: Page, username: string) {
  await page.goto('/sign-in')
  await page.getByLabel('Username').fill(username)
  await page.getByLabel('Password').fill(username)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL('/')
}

/** Picks a decision in the status dialog, gives the reason, and confirms. */
export async function changeStatus(page: Page, decision: string, reason?: string) {
  await page.getByRole('button', { name: 'Change status' }).click()
  await page.getByRole('radio', { name: decision }).click()
  if (reason) await page.getByLabel('Reason').fill(reason)
  await page.getByRole('dialog').getByRole('button', { name: decision }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
}

/** Fails with axe-core's WCAG 2.1 A/AA violations on the current page, once it has settled. */
export async function expectAccessible(page: Page) {
  // Scanning before hydration finds labels that are not wired up yet.
  await page.waitForLoadState('networkidle')
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  expect(
    violations.map(
      (v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`
    )
  ).toEqual([])
}
