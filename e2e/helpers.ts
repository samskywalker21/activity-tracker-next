import AxeBuilder from '@axe-core/playwright'
import { expect, type Page } from '@playwright/test'

/** Signs in as one of the seeded users, whose password is their username. */
export async function signIn(page: Page, username: string) {
  await page.goto('/sign-in')
  await page.getByLabel('Username').fill(username)
  await page.getByLabel('Password', { exact: true }).fill(username)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL('/')
}

/** Decides from the activity page's review panel, with the note a return or reject needs. */
export async function review(page: Page, decision: 'Approve' | 'Return' | 'Reject', note?: string) {
  if (note) await page.getByLabel(/^Note/).fill(note)
  await page.getByRole('button', { name: decision, exact: true }).click()
  await expect(page.getByText('Waiting for your review')).toBeHidden()
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
