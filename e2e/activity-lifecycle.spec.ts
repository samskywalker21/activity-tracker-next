import { expect, type Page, test } from '@playwright/test'
import { expectAccessible, review, signIn } from './helpers'

// One activity through its whole life, each step as the person who would take it. The steps
// depend on each other, so they run in order and stop at the first failure.
test.describe.configure({ mode: 'serial' })

const title = 'E2E planning workshop'
let url: string

const expectStatus = (page: Page, status: string) =>
  expect(page.getByRole('main').getByText(status, { exact: true }).first()).toBeVisible()

test('staff submits an activity', async ({ page }) => {
  await signIn(page, 'staff')
  await page.goto('/activities/new')

  await page.getByLabel('Title').fill(title)
  await page.locator('#type').click()
  await page.getByRole('option', { name: 'Event' }).click()
  await page.getByLabel('Venue').fill('Conference room')
  await page.locator('#startDate').click()
  await page.getByRole('button', { name: /^Today/ }).click()
  await page.locator('#endDate').click()
  // The start picker may still be fading out; the end picker's calendar is the later one.
  await page
    .getByRole('button', { name: /^Today/ })
    .last()
    .click()
  await page.getByRole('button', { name: 'Submit' }).click()

  await expect(page).toHaveURL(/\/activities\/\d+$/)
  url = new URL(page.url()).pathname
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
  await expectStatus(page, 'Pending')
  await expectAccessible(page)
})

test('the manager approves it, and staff is notified', async ({ page, browser }) => {
  await signIn(page, 'manager')
  await page.goto(url)
  await expectAccessible(page)
  await review(page, 'Approve')
  await expectStatus(page, 'Approved')

  const staff = await browser.newPage()
  await signIn(staff, 'staff')
  await expect(staff.getByRole('button', { name: /Notifications, 1 unread/ })).toBeVisible()
  await staff.getByRole('button', { name: /Notifications/ }).click()
  await expect(staff.getByText(`approved ${title}`)).toBeVisible()
  await staff.close()
})

test('staff edits the approved activity, which sends it back for review', async ({ page }) => {
  await signIn(page, 'staff')
  await page.goto(`${url}/edit`)
  await expect(page.getByText('Saving your changes sends it back for review.')).toBeVisible()
  await expectAccessible(page)

  await page.getByLabel('Venue').fill('Training room')
  await page.getByRole('button', { name: 'Save' }).click()

  await expect(page).toHaveURL(url)
  await expect(page.getByText('Training room')).toBeVisible()
  await expectStatus(page, 'Pending')
})

test('the manager returns it with a reason', async ({ page }) => {
  await signIn(page, 'manager')
  await page.goto(url)
  await review(page, 'Return', 'Please add the agenda.')
  await expectStatus(page, 'Returned')
})

test('staff sees the reason, edits, and resubmits', async ({ page }) => {
  await signIn(page, 'staff')
  await expect(page.getByText('“Please add the agenda.”')).toBeVisible()

  await page.goto(`${url}/edit`)
  await expect(page.getByText('Saving resubmits this activity for review.')).toBeVisible()
  await page.getByLabel('Remarks (optional)').fill('Agenda: planning, budget, timeline.')
  await page.getByRole('button', { name: 'Save' }).click()

  await expect(page).toHaveURL(url)
  await expectStatus(page, 'Pending')
})

test('a guest sees it on the calendar, with a summary only', async ({ page }) => {
  await page.goto('/calendar')
  // By keyboard: schedule-x makes each activity a focusable button.
  await page.locator('.sx__month-grid-event', { hasText: title }).focus()
  await page.keyboard.press('Enter')

  const summary = page.getByRole('dialog')
  await expect(summary.getByText('Training room')).toBeVisible()
  await expect(summary.getByRole('button', { name: 'Sign in to see more' })).toBeVisible()
  await expect(summary.getByRole('button', { name: 'Open' })).toHaveCount(0)

  await page.goto(url)
  await expect(page).toHaveURL(`/sign-in?next=${encodeURIComponent(url)}`)
})

test('staff cancels it, which needs a reason', async ({ page }) => {
  await signIn(page, 'staff')
  await page.goto(url)

  await page.getByRole('button', { name: 'Cancel activity' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel the activity' }).click()
  await expect(page.getByText('Give a reason')).toBeVisible()
  await page.getByLabel('Reason').fill('The venue is unavailable.')
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel the activity' }).click()

  await expectStatus(page, 'Cancelled')
  await expect(page.getByRole('link', { name: 'Edit' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Edit' })).toHaveCount(0)
})
