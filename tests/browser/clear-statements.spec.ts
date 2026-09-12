import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
async function account(page: Page) {
  await page.goto('/auth');
  await page.getByLabel('Email', { exact: true }).fill('audit@example.test');
  await page.getByLabel('Password', { exact: true }).fill('synthetic-only');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/dashboard$/);
  await page.goto('/account/data');
  await page.getByRole('button', { name: 'Clear statement data', exact: true }).click();
}
test.beforeEach(async ({ request }) => { await request.post('http://127.0.0.1:54329/__audit/state', { data: { scenario: 'populated' } }); });
test('clear requires confirmation and explains retained data at large text sizes', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await account(page);
  await page.evaluate(() => { document.documentElement.style.fontSize = '24px'; });
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('monthly upload usage remain');
  const clear = page.getByRole('button', { name: 'Permanently clear statement data', exact: true });
  await expect(clear).toBeDisabled();
  await page.getByLabel('Type CLEAR to confirm').fill('clear'); await expect(clear).toBeDisabled();
  await page.getByLabel('Type CLEAR to confirm').fill('CLEAR'); await expect(clear).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const result = await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  expect(result.violations.map(v => v.id)).toEqual([]);
  await page.mouse.click(1, 1);
  await expect(dialog).toBeVisible();
  await page.getByRole('button', { name: 'Keep my data', exact: true }).click();
  await expect(dialog).toHaveCount(0);
});
test('unconfirmed clear never auto-retries and retains its request ID across a reload', async ({ page }) => {
  await page.clock.install();
  const requests: { _request_id: string }[] = [];
  await page.route('**/rest/v1/rpc/clear_statement_data', async route => {
    requests.push(route.request().postDataJSON());
    if (requests.length > 1) await route.fulfill({json:{cleared:true,transactions:4,subscriptions:1,imports:1,reviews:0}});
  });
  await account(page); await page.getByLabel('Type CLEAR to confirm').fill('CLEAR');
  await page.getByRole('button', { name: 'Permanently clear statement data', exact: true }).click();
  await expect.poll(() => requests.length).toBe(1);
  await expect(page.getByRole('button', { name: 'Keep my data', exact: true })).toBeDisabled();
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toBeVisible();
  await page.clock.fastForward(30_100);
  await expect(page.getByRole('alert')).toContainText('could not confirm the reset');
  expect(requests).toHaveLength(1);
  await page.reload();
  await page.getByRole('button', { name: 'Clear statement data', exact: true }).click();
  await page.getByLabel('Type CLEAR to confirm').fill('CLEAR');
  await page.getByRole('button', { name: 'Permanently clear statement data', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Your imported statement data has been cleared');
  expect(requests).toHaveLength(2); expect(requests[1]._request_id).toBe(requests[0]._request_id);
  await expect(page).toHaveURL(/account\/data$/);
  await expect(page.getByRole('heading',{name:'Statements & data',exact:true})).toBeVisible();
});
test('malformed reset response cannot claim success or discard retry progress', async ({ page }) => {
  await page.route('**/rest/v1/rpc/clear_statement_data', route => route.fulfill({json:{message:'unexpected'}}));
  await account(page); await page.getByLabel('Type CLEAR to confirm').fill('CLEAR');
  await page.getByRole('button', { name: 'Permanently clear statement data', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('not confirmed');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'has been cleared' })).toHaveCount(0);
});
test('support is public and reachable from Account without a purchase link', async ({ page }) => {
  await page.goto('/support');
  await expect(page.getByRole('heading', { name: 'Help and support', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'privacy@trycasher.com', exact: true })).toHaveAttribute('href','mailto:privacy@trycasher.com');
  await expect(page.getByText('Other currencies are not supported.', {exact:false})).toBeVisible();
  await account(page); await page.getByRole('button', {name:'Keep my data',exact:true}).click();
  await page.getByRole('link', { name: 'Help and support', exact: true }).click();
  await expect(page).toHaveURL(/support$/);
  await expect(page.locator('a[href*="checkout.stripe.com"],a[href="/pricing"]')).toHaveCount(0);
});
