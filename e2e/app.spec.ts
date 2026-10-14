import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { readFile } from 'node:fs/promises'

test.beforeEach(async ({ page }) => {
  await page.goto('./')
  await expect(page.getByText('Opening your workout journal…')).toBeHidden()
})

test('opens Friends without exposing a directory while signed out and preserves the current counter', async ({
  page,
}, testInfo) => {
  await page.getByRole('button', { name: '+10', exact: true }).click()
  await page.getByRole('button', { name: 'Friends', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Stronger together.' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign in to connect' })).toBeVisible()
  expect(await page.locator('input[type="checkbox"]').count()).toBe(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  expect(results.violations).toEqual([])
  await page.screenshot({ path: testInfo.outputPath('friends-signed-out.png'), fullPage: true })
  await page.getByRole('button', { name: 'Track', exact: true }).click()
  await expect(page.getByLabel('Current session reps')).toHaveText('10')
})

test('has a responsive, accessible empty state and installable manifest', async ({
  page,
}, testInfo) => {
  await expect(
    page.getByRole('heading', { name: 'A little stronger. Every single day.' }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save 0 push-ups' })).toBeDisabled()
  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href')
  const response = await page.request.get(manifestHref!)
  const manifest = await response.json()
  expect(manifest.start_url).toBe('/Pushups/')
  expect(manifest.scope).toBe('/Pushups/')
  expect(manifest.display).toBe('standalone')
  for (const icon of manifest.icons) expect((await page.request.get(icon.src)).ok()).toBe(true)
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  const readyNotice = page.getByRole('button', { name: 'Dismiss app notice' })
  if (await readyNotice.isVisible()) await readyNotice.click()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  await expect(page.getByRole('heading', { name: 'The last 7 days' })).toBeVisible()
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  expect(results.violations).toEqual([])
  await page.screenshot({ path: testInfo.outputPath('track-empty.png'), fullPage: true })
  await page.getByRole('button', { name: 'History', exact: true }).click()
  await expect(page.getByText('Your story starts with one session.')).toBeVisible()
  await page.getByRole('button', { name: 'Progress', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Your activity' })).toBeVisible()
  await page.getByRole('button', { name: 'Weekly', exact: true }).click()
  await expect(page.getByText('Last 12 weeks · starts Monday · local time')).toBeVisible()
  await page.getByRole('button', { name: 'Monthly', exact: true }).click()
  await expect(page.getByText('Last 12 months · local time')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  await page.screenshot({ path: testInfo.outputPath('progress-empty.png'), fullPage: true })
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([])
})

test('saves once on a double tap, persists through reload, edits and confirms deletion', async ({
  page,
}) => {
  await page.getByRole('button', { name: '+20', exact: true }).click()
  await page.getByRole('button', { name: '+10', exact: true }).click()
  await page
    .getByRole('button', { name: 'Save 30 push-ups' })
    .evaluate((button: HTMLButtonElement) => {
      button.click()
      button.click()
    })
  await expect(page.getByLabel('Today’s summary')).toContainText('1 session logged')
  await expect(page.getByLabel('Current session reps')).toHaveText('0')
  await page.reload()
  await expect(page.getByLabel('Today’s summary')).toContainText('30')
  await page.getByRole('button', { name: 'History', exact: true }).click()
  await page.getByRole('button', { name: /^Edit 30 push-up session/ }).click()
  await page.getByRole('spinbutton', { name: 'Push-ups' }).fill('42')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByLabel('Today’s summary')).toContainText('42')
  await page.getByRole('button', { name: /^Delete 42 push-up session/ }).click()
  await page.getByRole('button', { name: 'Keep session' }).click()
  await expect(page.getByLabel('Today’s summary')).toContainText('1 session logged')
  await page.getByRole('button', { name: /^Delete 42 push-up session/ }).click()
  await page.getByRole('button', { name: 'Delete session', exact: true }).click()
  await expect(page.getByLabel('Today’s summary')).toContainText('0 sessions logged')
  await expect(page.getByText('Your story starts with one session.')).toBeVisible()
})

test('opens, saves and navigates while completely offline', async ({ page, context }) => {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await expect
    .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
    .toBe(true)
  await page.getByRole('button', { name: '+10', exact: true }).click()
  await page.getByRole('button', { name: 'Save 10 push-ups' }).click()
  await expect(page.getByLabel('Today’s summary')).toContainText('1 session logged')
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByLabel('Today’s summary')).toContainText('10')
  await page.getByRole('button', { name: '+5', exact: true }).click()
  await page.getByRole('button', { name: 'Save 5 push-ups' }).click()
  await expect(page.getByLabel('Today’s summary')).toContainText('2 sessions logged')
  await page.getByRole('button', { name: 'Progress', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Your activity' })).toBeVisible()
  await page.getByRole('button', { name: 'History', exact: true }).click()
  await expect(page.getByRole('button', { name: /^Edit .* push-up session/ })).toHaveCount(2)
  await page.reload()
  await expect(page.getByLabel('Today’s summary')).toContainText('15')
})

test('exports a backup and merges it without duplicating saved sessions', async ({
  page,
}, testInfo) => {
  await page.getByRole('button', { name: '+20', exact: true }).click()
  await page.getByRole('button', { name: 'Save 20 push-ups' }).click()
  await expect(page.getByLabel('Today’s summary')).toContainText('1 session logged')
  await page.getByRole('button', { name: 'Settings and backups' }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export JSON' }).click()
  const download = await downloadPromise
  const backupPath = testInfo.outputPath('exported-backup.json')
  await download.saveAs(backupPath)
  const backup = JSON.parse(await readFile(backupPath, 'utf8'))
  expect(backup.sessions).toHaveLength(1)
  expect(backup.sessions[0].reps).toBe(20)
  await page.getByLabel('Choose backup file').setInputFiles(backupPath)
  await expect(page.getByText('Ready to merge 1 session')).toBeVisible()
  await page.getByRole('button', { name: 'Merge backup' }).click()
  await expect(page.getByRole('dialog').getByRole('status')).toHaveText(
    '0 sessions imported. 1 duplicates skipped.',
  )
  await page
    .getByLabel('Choose backup file')
    .setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{') })
  await expect(page.getByRole('alert')).toContainText('not valid JSON')
  await page.getByRole('button', { name: 'Close dialog' }).click()
  await expect(page.getByLabel('Today’s summary')).toContainText('1 session logged')
})

test('updates other open tabs when local sessions change', async ({ page, context }) => {
  const second = await context.newPage()
  await second.goto('./')
  await expect(second.getByText('Opening your workout journal…')).toBeHidden()
  await page.getByRole('button', { name: '+5', exact: true }).click()
  await page.getByRole('button', { name: 'Save 5 push-ups' }).click()
  await expect(second.getByLabel('Today’s summary')).toContainText('1 session logged')
  await expect(second.getByLabel('Today’s summary')).toContainText('5')
})

test('keeps narrow layouts usable and settings keyboard accessible', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  await page.getByRole('button', { name: 'Settings and backups' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  expect(results.violations).toEqual([])
  await page.getByRole('button', { name: 'Close dialog' }).press('Escape')
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('button', { name: 'Settings and backups' })).toBeFocused()
  await page.getByRole('button', { name: 'Progress', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Your activity' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
})

test('adds a past session offline, prevents duplicate taps, and updates history and streaks', async ({
  page,
  context,
}, testInfo) => {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await expect
    .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
    .toBe(true)
  await page.getByRole('button', { name: '+10', exact: true }).click()
  await page.getByRole('button', { name: 'Save 10 push-ups' }).click()
  await expect(page.getByLabel('Today’s summary')).toContainText('1 session logged')
  await context.setOffline(true)
  await page.getByRole('button', { name: 'History', exact: true }).click()
  await page.getByRole('button', { name: 'Add session', exact: true }).click()
  await page.getByLabel('Time', { exact: true }).fill('12:00')
  await page.getByRole('spinbutton', { name: 'Push-ups' }).fill('25')
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([])
  await page.screenshot({ path: testInfo.outputPath('add-past-session.png') })
  await page
    .getByRole('button', { name: 'Save session', exact: true })
    .evaluate((button: HTMLButtonElement) => {
      button.click()
      button.click()
    })
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(page.getByRole('region', { name: 'Yesterday', exact: true })).toContainText(
    '25 push-ups',
  )
  await expect(page.getByRole('button', { name: /^Edit .* push-up session/ })).toHaveCount(2)
  await expect(page.getByLabel('Today’s summary')).toContainText('10')
  await expect(page.getByLabel('Today’s summary')).toContainText('1 session logged')
  await page.getByRole('button', { name: 'Progress', exact: true }).click()
  await expect(page.getByText('2 day current streak', { exact: false })).toBeVisible()
  await expect(page.locator('.period-card').filter({ hasText: 'All time' })).toContainText('35')
  await page.reload()
  await page.getByRole('button', { name: 'History', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Yesterday', exact: true })).toContainText(
    '25 push-ups',
  )
})
