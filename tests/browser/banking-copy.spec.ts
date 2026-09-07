import { test, expect } from '@playwright/test';

test('banking disclosure distinguishes statement data, credentials and payments', async ({ page }) => {
  await page.goto('/privacy');
  await expect(page.getByRole('heading', { name: 'Bank connections and payments' })).toBeVisible();
  await expect(page.getByText(/Buying Pro does not connect your bank/)).toBeVisible();
  await expect(page.getByText(/Transaction data is banking information/)).toBeVisible();
  await page.goto('/pricing');
  await expect(page.getByText(/Stripe collects payment details for Pro/)).toBeVisible();
});

for (const language of ['en', 'fr', 'es', 'ro', 'de', 'it', 'pl']) {
  test(`about banking disclosure remains readable in ${language}`, async ({ page }) => {
    await page.addInitScript(lang => localStorage.setItem('language', lang), language);
    await page.setViewportSize({width:320, height:900});
    await page.goto('/about');
    await expect(page.locator('main')).toContainText('Stripe');
    await expect(page.locator('main')).toContainText(/Open[- ]Banking/i);
    await expect(page.locator('main')).not.toContainText('100%');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}
