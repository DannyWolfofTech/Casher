import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function login(page: Page) {
  await page.goto('/auth');
  await page.getByLabel('Email', { exact: true }).fill('audit@example.test');
  await page.getByLabel('Password', { exact: true }).fill('synthetic-only');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/dashboard$/);
}
async function accessible(page: Page) {
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(result.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }))).toEqual([]);
}
test.beforeEach(async ({ request }) => { await request.post('http://127.0.0.1:54329/__audit/state', { data: { scenario: 'populated' } }); });

for (const dark of [false, true]) {
  test(`large text preserves form layout and error contrast in ${dark ? 'dark' : 'light'} mode`, async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 852 });
    await page.addInitScript(dark => localStorage.setItem('theme', dark ? 'dark' : 'light'), dark);
    await login(page);
    await page.evaluate(() => { document.documentElement.style.fontSize = '24px'; });
    await page.goto('/dashboard/subscriptions'); await page.getByRole('button', { name: 'Manage Fitness membership with a long service name', exact: true }).click();
    const button = page.getByRole('button', { name: 'I cancelled with the provider' });
    expect(await button.evaluate(e => e.scrollWidth <= e.clientWidth && e.scrollHeight <= e.clientHeight)).toBe(true);
    await accessible(page);
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await page.goto('/account'); await page.getByRole('button',{name:'Delete account',exact:true}).click();
    await page.evaluate(() => { document.documentElement.style.fontSize = '24px'; });
    // Enable the synthetic account control to audit its active contrast; never submit.
    await page.getByLabel('Type DELETE to confirm').fill('DELETE');
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await accessible(page);
    await page.getByLabel('Type DELETE to confirm').fill('');
    await page.goto('/auth?mode=recovery#error=access_denied');
    await expect(page.getByRole('alert')).toBeVisible();
    await accessible(page);
  });
}

test('CSV selection offers a separate accessible remove control', async ({ page }) => {
  await login(page);
  await page.getByRole('button', { name: 'Upload statement', exact: true }).click();
  await page.locator('input[type=file]').setInputFiles({ name: 'synthetic.csv', mimeType: 'text/csv', buffer: Buffer.from('Date,Description,Amount\n2026-01-01,Example,-1') });
  await expect(page.getByRole('button', { name: 'Remove selected CSV' })).toBeVisible();
  await accessible(page);
  await page.getByRole('button', { name: 'Remove selected CSV' }).click();
  await expect(page.getByRole('button', { name: 'Confirm import', exact: true })).toHaveCount(0);
});

for (const mode of ['invalid-theme', 'restricted-preferences']) {
  test(`the app still renders with ${mode}`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(mode => {
      if (mode === 'invalid-theme') localStorage.setItem('theme', 'not a valid class');
      else for (const name of ['getItem', 'setItem'] as const) {
        const original = Storage.prototype[name];
        Object.defineProperty(Storage.prototype, name, { value: function (key: string, value: string) {
          if (key === 'theme' || key === 'language') throw new DOMException('Storage unavailable', 'SecurityError');
          return original.call(this, key, value);
        } });
      }
    }, mode);
    await login(page);
    await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();
    await page.getByRole('link',{name:'Account',exact:true}).click(); await page.getByRole('button',{name:/Appearance: Original light/}).click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    expect(errors).toEqual([]);
  });
}

test('a stalled statement request gives a retry and never presents incomplete totals', async ({ page }) => {
  await page.clock.install();
  let calls = 0;
  const stalled = '**/rest/v1/transactions?*';
  await page.route(stalled, () => { calls++; });
  await login(page);
  await expect.poll(() => calls).toBe(1);
  await page.clock.fastForward(15_100);
  await expect(page.getByRole('heading', { name: 'Your overview could not be loaded' })).toBeVisible();
  await expect(page.getByRole('list', {name:'Money out by category'})).toHaveCount(0);
  expect(calls).toBe(1);
  await page.unroute(stalled);
  await page.getByRole('alert').filter({ has: page.getByRole('heading', { name: 'Your overview could not be loaded' }) }).getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByRole('list', {name:'Money out by category'})).toBeVisible();
});

test('a stalled allowance check fails closed and can be retried', async ({ page }) => {
  await page.clock.install();
  let started = false;
  const stalled = '**/rest/v1/rpc/get_upload_usage';
  await page.route(stalled, () => { started = true; });
  await login(page);
  await expect.poll(() => started).toBe(true);
  await page.clock.fastForward(15_100);
  await expect(page.getByRole('alert')).toContainText('Your upload allowance could not be loaded');
  await page.getByRole('button', { name: 'Upload statement', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Choose bank statement CSV' })).toHaveCount(0);
  await page.unroute(stalled);
  await page.getByRole('button', { name: 'Retry account check' }).click();
  await expect(page.getByRole('button', { name: 'Choose bank statement CSV' })).toBeVisible();
});

test('long merchant names and large amounts fit a small phone with enlarged text', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 852 });
  const merchant = `Merchant${'W'.repeat(72)}`;
  await page.route('**/rest/v1/transactions?*', async route => {
    const response = await route.fetch();
    const rows = await response.json();
    await route.fulfill({ response, json: rows.map((row: Record<string, unknown>) => ({ ...row,
      amount: row.direction === 'credit' ? 99_999_999.99 : -99_999_999.99,
      description: merchant, category: `Category${'W'.repeat(65)}`,
    })) });
  });
  await page.route('**/rest/v1/detected_subscriptions?*', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, json: (await response.json()).map((row: Record<string, unknown>) => ({ ...row,
      service_name: merchant, amount: 1_923_076.92, frequency: 'weekly',
    })) });
  });
  await login(page);
  await expect(page.getByRole('list', {name:'Money out by category'})).toBeVisible();
  await page.evaluate(() => { document.documentElement.style.fontSize = '24px'; });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto('/dashboard/subscriptions'); await expect(page.getByRole('region', { name: 'Expected renewals' })).toContainText(merchant);
  await page.goto('/dashboard/history'); await page.getByRole('button',{name:'Over time',exact:true}).click();
  await expect(page.getByRole('heading', { name: 'Monthly spending' })).toBeVisible();
  await page.evaluate(() => { document.documentElement.style.fontSize = '24px'; });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByRole('region',{name:/Monthly spending chart/})).toContainText('£899,999,999.91');
});

test('an import cannot be hidden while processing and a stalled response offers a safe same-file retry', async ({ page }) => {
  await page.clock.install();
  let attempts = 0;
  await page.route('**/functions/v1/process-csv', () => { attempts++; });
  await login(page);
  await page.getByRole('button', { name: 'Upload statement', exact: true }).click();
  await page.locator('input[type=file]').setInputFiles({ name: 'retry-same-file.csv', mimeType: 'text/csv', buffer: Buffer.from('Date,Description,Amount\n2026-09-01,Test,-1') });
  await page.getByRole('button', { name: 'Review statement', exact: true }).click(); await page.getByRole('button', {name:'Confirm import',exact:true}).click();
  await expect.poll(() => attempts).toBe(1);
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog',{name:'Import statement',exact:true})).toBeVisible();
  await page.clock.fastForward(60_100);
  await expect(page.getByRole('alert').filter({ hasText: 'retry the same file' }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirm import', exact: true })).toBeEnabled();
  await expect(page.getByText('retry-same-file.csv', { exact: true })).toBeVisible();
  expect(attempts).toBe(1); // An uncertain write must never retry itself.
});

test('History refreshes immediately after an import instead of reusing its pre-import totals', async ({ page }) => {
  let imported = false;
  await page.route('**/rest/v1/transactions?*', async route => {
    const response = await route.fetch();
    const original = await response.json();
    await route.fulfill({ response, json: imported ? original.map((row: Record<string, unknown>) => ({ ...row, amount: row.direction === 'debit' ? -1 : 1 })) : original });
  });
  await page.route('**/functions/v1/process-csv', route => {
    imported = true;
    return route.fulfill({ json: { code: 'OK', transactionsCount: 1, subscriptionsCount: 0, usage: { uploadsUsed: 3, uploadLimit: null, tier: 'pro', canUpload: true } } });
  });
  await login(page);
  await page.getByRole('link', { name: 'Charts & insights', exact: true }).click(); await page.getByRole('button',{name:'Over time',exact:true}).click();
  await expect(page.getByRole('heading', { name: 'Monthly spending' })).toBeVisible();
  await page.getByRole('link', { name: 'Back to overview', exact: true }).click();
  await page.getByRole('button', { name: 'Upload statement', exact: true }).click();
  await page.locator('input[type=file]').setInputFiles({ name: 'refresh.csv', mimeType: 'text/csv', buffer: Buffer.from('Date,Description,Amount\n2026-09-01,Test,-1') });
  await page.getByRole('button', { name: 'Review statement', exact: true }).click(); await page.getByRole('button', {name:'Confirm import',exact:true}).click();
  await expect(page.getByText('1 transactions imported.', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Charts & insights', exact: true }).click(); await page.getByRole('button',{name:'Over time',exact:true}).click();
  await expect(page.getByRole('region',{name:/Monthly spending chart/})).toContainText('£9.00');
  await expect(page.getByRole('region',{name:/Monthly spending chart/})).not.toContainText('£1,281.98');
});

test('an uncertain last free import retains the file when the server reports an exhausted allowance', async ({ page }) => {
  await page.clock.install();
  let committed = false;
  await page.route('**/rest/v1/rpc/get_upload_usage', route => route.fulfill({ json: [{ uploads_used: committed ? 1 : 0, upload_limit: 1, tier: 'free' }] }));
  await page.route('**/functions/v1/process-csv', route => {
    if (!committed) { committed = true; return; }
    return route.fulfill({ json: { code: 'REPLAY', replay: true, message: 'This statement was already imported.', transactionsCount: 0, usage: { uploadsUsed: 1, uploadLimit: 1, tier: 'free', canUpload: false } } });
  });
  await page.addInitScript(() => localStorage.setItem('casher:onboarding:00000000-0000-4000-8000-000000000001', 'true'));
  await login(page);
  // The fixtures use a fixed synthetic identity; dismiss onboarding if present.
  await expect(page.getByRole('button', { name: 'Upload statement', exact: true }).or(page.getByRole('dialog'))).toBeVisible();
  if (await page.getByRole('dialog').isVisible()) await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Upload statement', exact: true }).click();
  await page.locator('input[type=file]').setInputFiles({ name: 'already-committed.csv', mimeType: 'text/csv', buffer: Buffer.from('Date,Description,Amount\n2026-09-01,Test,-1') });
  await page.getByRole('button', { name: 'Review statement', exact: true }).click(); await page.getByRole('button', {name:'Confirm import',exact:true}).click();
  await expect.poll(() => committed).toBe(true);
  await page.clock.fastForward(60_100);
  await expect(page.getByText('No new uploads remain this month.', { exact: false })).toBeVisible();
  await expect(page.getByText('already-committed.csv', { exact: true })).toBeVisible();
  await page.getByRole('button', {name:'Confirm import',exact:true}).click();
  await expect(page.getByRole('status').filter({ hasText: 'This statement was already imported.' }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Upload statement', exact: true })).toBeEnabled();
});

test('Recent imports stops waiting on a stalled request and can recover', async ({ page }) => {
  await page.clock.install();
  let started = false;
  const route = '**/rest/v1/upload_history?*';
  await page.route(route, () => { started = true; });
  await login(page);
  await page.goto('/account/data'); await expect.poll(() => started).toBe(true);
  await page.clock.fastForward(15_100);
  await expect(page.getByText('Import history could not be loaded.', { exact: true })).toBeVisible();
  await page.unroute(route);
  await page.getByRole('alert').filter({ hasText: 'Import history could not be loaded.' }).getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByText('Import history could not be loaded.', { exact: true })).toHaveCount(0);
  await expect(page.getByText('No previous uploads yet.', { exact: false })).toHaveCount(0);
});

test('successful account deletion keeps its confirmation after signing out', async ({ page }) => {
  await page.route('**/functions/v1/delete-account', route => route.fulfill({ json: { deleted: true } }));
  await login(page);
  await page.getByRole('link', { name: 'Account', exact: true }).click(); await page.getByRole('button',{name:'Delete account',exact:true}).click();
  await page.getByLabel('Type DELETE to confirm').fill('DELETE');
  await page.getByRole('button', { name: 'Delete account and cancel Casher' }).click();
  await expect(page).toHaveURL(/auth\?deleted=1$/);
  await expect(page.getByText('Your Casher account has been deleted.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
});

test('an unreadable success response never claims an import succeeded', async ({ page }) => {
  await page.route('**/functions/v1/process-csv', route => route.fulfill({ json: null }));
  await login(page);
  await page.getByRole('button', { name: 'Upload statement', exact: true }).click();
  await page.locator('input[type=file]').setInputFiles({ name: 'unconfirmed.csv', mimeType: 'text/csv', buffer: Buffer.from('Date,Description,Amount\n2026-09-01,Test,-1') });
  await page.getByRole('button', { name: 'Review statement', exact: true }).click(); await page.getByRole('button', {name:'Confirm import',exact:true}).click();
  await expect(page.getByRole('alert').filter({ hasText: 'We could not confirm the import result.' }).first()).toBeVisible();
  await expect(page.getByText('unconfirmed.csv', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirm import', exact: true })).toBeEnabled();
  await expect(page.getByText('0 transactions imported.', { exact: true })).toHaveCount(0);
});
