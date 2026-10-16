import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test('keeps populated Friends inside the viewport with a separately scrolling calendar', async ({
  page,
}, testInfo) => {
  await page.goto('e2e/fixtures/friends.html')
  await page.getByRole('button', { name: 'Friends', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Alex’s progress' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Alex’s activity' })).toBeVisible()
  for (const width of [320, 360, 393, 600, 768, 1440]) {
    await page.setViewportSize({ width, height: 851 })
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(width)
    for (const panel of await page.locator('.friends-content > *').all()) {
      const box = await panel.boundingBox()
      expect(box!.x).toBeGreaterThanOrEqual(0)
      expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1)
    }
    const calendar = page.getByRole('region', {
      name: 'Daily activity calendar. Scroll horizontally to see earlier months.',
    })
    if (width < 768) {
      expect(await calendar.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(
        true,
      )
      await calendar.evaluate((element) => {
        element.scrollLeft = 0
      })
      await expect.poll(() => calendar.evaluate((element) => element.scrollLeft)).toBe(0)
    }
  }
  await page.setViewportSize({ width: 393, height: 851 })
  const notice = page.getByRole('button', { name: 'Dismiss app notice' })
  if (await notice.isVisible()) await notice.click()
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: testInfo.outputPath('friends-populated.png') })
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([])
  await page.getByRole('button', { name: 'Weekly', exact: true }).click()
  await page.getByText('View data', { exact: true }).click()
  await expect(page.getByRole('table', { name: 'Push-up chart data' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(393)
  await page.getByText('View daily totals', { exact: true }).click()
  await expect(
    page.getByRole('table', { name: 'Active day totals over the last year' }),
  ).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(393)
})

test('wraps long friend names at normal mobile zoom', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await page.goto('e2e/fixtures/friends.html?longName=1')
  await page.getByRole('button', { name: 'Friends', exact: true }).click()
  await expect(page.getByRole('heading', { name: `${'Alex'.repeat(10)}’s activity` })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
})
