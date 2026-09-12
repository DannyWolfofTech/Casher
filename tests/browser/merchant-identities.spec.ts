import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { parseTransactionsCsv } from '../../supabase/functions/_shared/csv-parser';

const month = new Date().toISOString().slice(0, 7);
const userId = '00000000-0000-4000-8000-000000000001';
const fixture = [
  ['TESCO STORES 1234', 'Groceries', -43.2], ['PURE GYM LTD 0042', 'Fitness', -35],
  ['Corner shop 84', 'Groceries', -18.4], ['The Apple Tree Cafe', 'Dining', -4.5],
  ['NETFLIX.COM', 'Subscription', 12.99], ['UBER *EATS', 'Dining', -21.5],
].map(([description, category, amount], i) => ({ id: `merchant-${i}`, user_id: userId, date: `${month}-02`, description, merchant: description,
  category, amount, direction: Number(amount) > 0 ? 'credit' : 'debit', reviewed_at: null }));

async function login(page: Page) {
  await page.goto('/auth');
  await page.getByLabel('Email', { exact: true }).fill('audit@example.test');
  await page.getByLabel('Password', { exact: true }).fill('synthetic-only');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/dashboard$/); await page.getByRole('navigation',{name:'Main navigation'}).getByRole('link',{name:'Activity',exact:true}).click();
}
test.beforeEach(async ({ request, page }) => {
  await request.post('http://127.0.0.1:54329/__audit/state', { data: { scenario: 'populated' } });
  await page.route('**/rest/v1/transactions?*', route => route.fulfill({ json: fixture }));
});

test('recognised logos, canonical search, raw details and refund signs work on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 });
  const writes: string[] = [];
  page.on('request', request => { if (request.url().includes('/rest/v1/') && request.method() !== 'GET' && !request.url().includes('/rpc/get_')) writes.push(request.url()); });
  await login(page);
  const transactions = page.getByRole('list', { name: 'Transactions', exact: true });
  await expect(transactions.locator('[data-merchant-id="tesco"]')).toHaveAttribute('data-logo-state', 'loaded');
  await expect(transactions.getByText('The Apple Tree Cafe', { exact: true })).toBeVisible();
  await expect(transactions.locator('[data-merchant-id="unknown"]')).toHaveCount(2);
  await expect(transactions.getByText('+£12.99', { exact: true })).toBeVisible();
  await expect(transactions.getByText('-£43.20', { exact: true })).toBeVisible();
  await page.getByLabel('Search transactions').fill('PureGym');
  await expect(transactions.getByText('PureGym', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /^Review PURE GYM LTD 0042/ }).click();
  await expect(page.getByRole('dialog')).toContainText('PURE GYM LTD 0042');
  await expect(page.getByRole('dialog')).toContainText('-£35.00');
  await expect(page.getByRole('dialog').locator('[data-merchant-id="puregym"]')).toHaveAttribute('data-logo-state', 'loaded');
  await page.getByRole('button', { name: 'Close', exact:true }).click();
  await page.getByLabel('Search transactions').fill('0042');
  await expect(transactions.getByText('PureGym', { exact: true })).toBeVisible();
  expect(writes).toEqual([]);
  await page.getByLabel('Search transactions').clear();
  await transactions.scrollIntoViewIfNeeded();
  await page.screenshot({ path: '.audit-results/merchant-identities/activity-393.png' });
});

test('a stalled or missing logo never hides a row, shifts its size or blocks totals', async ({ page, context }) => {
  await page.setViewportSize({ width: 393, height: 852 });
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/merchants/tesco-*.png', async route => { await held; await route.abort(); });
  await login(page);
  const mark = page.getByRole('list', { name: 'Transactions', exact: true }).locator('[data-merchant-id="tesco"]');
  await expect(mark).toHaveAttribute('data-logo-state', 'loading');
  await expect(mark.locator('svg')).toBeVisible();
  await expect(page.getByText('-£43.20',{exact:true})).toBeVisible();
  const before = await mark.boundingBox();
  release();
  await expect(mark).toHaveAttribute('data-logo-state', 'failed');
  await expect(mark.locator('svg')).toBeVisible();
  await expect(mark.locator('img')).toHaveCount(0);
  expect(await mark.boundingBox()).toEqual(before);
  await context.setOffline(true);
  await page.getByLabel('Search transactions').fill('PureGym');
  await expect(page.getByRole('list', { name: 'Transactions', exact: true }).getByText('PureGym', { exact: true })).toBeVisible();
  await context.setOffline(false);
});

for (const dark of [false, true]) {
  test(`merchant marks fit narrow large-text ${dark ? 'dark' : 'light'} layouts`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 852 });
    await page.addInitScript(dark => localStorage.setItem('theme', dark ? 'dark' : 'light'), dark);
    await login(page);
    await page.evaluate(() => { document.documentElement.style.fontSize = '24px'; });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('navigation',{name:'Main navigation'}).getByRole('link',{name:'Subscriptions',exact:true}).click();
    await expect(page.locator('[data-merchant-id="spotify"]').first()).toHaveAttribute('data-logo-state', 'loaded');
    await expect(page.getByRole('button', { name: 'Manage Netflix', exact: true })).toHaveAccessibleDescription(/£12\.99, monthly\. Estimated next payment/);
    await page.getByRole('button', { name: 'Manage Netflix', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText('Statement description');
    await expect(page.getByRole('dialog').locator('[data-merchant-id="netflix"]')).toHaveAttribute('data-logo-state', 'loaded');
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
    await page.screenshot({ path: `.audit-results/merchant-identities/detail-320-${dark ? 'dark' : 'light'}.png` });
  });
}

test('desktop rows use local assets and preserve their accessible description', async ({ page }) => {
  await login(page);
  const row = page.getByRole('button', {name:/^Review TESCO STORES 1234/});
  await expect(row.getByText('Tesco', {exact:true})).toBeVisible();
  await expect(row.locator('[data-merchant-id="tesco"]')).toHaveAttribute('data-logo-state', 'loaded');
  expect(await row.locator('[data-merchant-id="tesco"] img').evaluate(img => (img as HTMLImageElement).naturalWidth)).toBeGreaterThanOrEqual(80);
  const sources = await page.locator('[data-merchant-id] img').evaluateAll(imgs => imgs.map(img => (img as HTMLImageElement).src));
  expect(sources.every(src => src.startsWith('http://127.0.0.1:8080/merchants/'))).toBe(true);
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
});

test('new CSV rows acquire logos on refresh without rewriting their imported fields', async ({ page }) => {
  let records: unknown[] = [];
  await page.route('**/rest/v1/transactions?*', route => route.fulfill({ json: records }));
  await page.route('**/functions/v1/process-csv', async route => {
    const parsed = parseTransactionsCsv(route.request().postDataJSON().csv);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error('Synthetic CSV parsing failed');
    records = parsed.transactions.map((row, i) => ({ ...row, id: `imported-${i}`, user_id: userId }));
    await route.fulfill({ json: { code: 'OK', transactionsCount: records.length, subscriptionsCount: 0 } });
  });
  await login(page);
  await page.getByRole('button', { name: 'Upload statement', exact: true }).click();
  await page.locator('input[type=file]').setInputFiles({ name: 'synthetic-merchants.csv', mimeType: 'text/csv', buffer: Buffer.from(`Date,Description,Amount\n${month}-02,TESCO STORES 1234,-43.20\n${month}-02,PAYPAL *NETFLIX,-12.99\n${month}-02,Corner shop 84,-18.40`) });
  await page.getByRole('button', { name: 'Review statement', exact: true }).click(); await page.getByRole('button',{name:'Confirm import',exact:true}).click();
  await expect(page.getByText('3 transactions imported.', { exact: true })).toBeVisible();
  await expect(page.getByRole('list',{name:'Transactions',exact:true}).locator('[data-merchant-id="tesco"]')).toHaveAttribute('data-logo-state', 'loaded');
  await expect(page.getByRole('list',{name:'Transactions',exact:true}).locator('[data-merchant-id="netflix"]')).toHaveAttribute('data-logo-state', 'loaded');
  await expect(page.getByRole('list',{name:'Transactions',exact:true}).locator('[data-merchant-id="unknown"]')).toHaveCount(1);
  expect(records).toEqual(expect.arrayContaining([expect.objectContaining({ description: 'TESCO STORES 1234', amount: -43.2, direction: 'debit' })]));
});
