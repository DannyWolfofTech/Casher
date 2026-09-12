import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const api = 'http://127.0.0.1:54329/__audit/state';
const now = new Date();
const month = (offset: number) => new Date(Date.UTC(now.getFullYear(), now.getMonth() + offset, 1)).toISOString().slice(0, 7);
async function login(page: Page) {
  await page.goto('/auth'); await page.getByLabel('Email', { exact: true }).fill('audit@example.test'); await page.getByLabel('Password', { exact: true }).fill('synthetic-only'); await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/dashboard$/);
}
async function go(page: Page, name: string) { await page.getByRole('navigation', {name:'Main navigation'}).getByRole('link', {name,exact:true}).click(); }
async function review(page: Page, description: string) { await go(page,'Activity'); await page.getByRole('button',{name:new RegExp(`^Review ${description}`)}).click(); await page.getByRole('button',{name:'Edit transaction',exact:true}).click(); }
async function subscription(page: Page, name: string) { await go(page,'Subscriptions'); await page.getByRole('button',{name:`Manage ${name}`,exact:true}).click(); }
test.beforeEach(async ({ request }) => { await request.post(api, { data: { scenario: 'populated' } }); });
test('public navigation starts the destination at its heading', async ({page}) => {
  await page.setViewportSize({width:390,height:700});
  await page.goto('/');
  await page.getByRole('button',{name:'View Pricing',exact:true}).click();
  await expect(page).toHaveURL(/pricing$/);
  await expect(page.getByRole('heading',{level:1,name:'Choose Your Plan'})).toBeInViewport();
  expect(await page.evaluate(()=>window.scrollY)).toBe(0);
});
for (const width of [320, 390, 768, 1440]) {
  test(`dashboard fits ${width}px and renders ranked spending bars`, async ({page}) => {
    await page.setViewportSize({width,height:900}); await login(page);
    const categories=page.getByRole('list',{name:'Money out by category'});
    await expect(categories.getByText('£950.00',{exact:true})).toBeVisible();
    await expect(categories.locator('li')).toHaveCount(3);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.getByRole('link',{name:'Charts & insights',exact:true}).click();
    await expect(page.getByRole('list',{name:'Money out by category'}).locator('li')).toHaveCount(9);
    expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
  });
}
test('month selection reconciles total, category values and table; search handles punctuation', async ({ page }) => {
  await login(page);
  await page.getByLabel('Statement month').selectOption(month(-1));
  await expect(page.getByText('£1,676.06', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('cell', { name: /Example salary/ })).toHaveCount(0);
  await go(page,'Activity'); await page.getByRole('textbox', { name: 'Search transactions' }).fill('(),%_');
  await expect(page.getByText('No transactions match your search.')).toBeVisible();
  await page.getByRole('textbox', { name: 'Search transactions' }).fill('rent');
  await expect(page.getByRole('button', { name: /^Review Example rent payment/ })).toBeVisible();
});
test('old statements are selected automatically', async ({ page, request }) => {
  await request.post(api, { data: { scenario: 'historical' } }); await login(page);
  await expect(page.getByLabel('Statement month')).toHaveValue(month(-1));
  await expect(page.getByText('£1,676.06', { exact: true }).first()).toBeVisible();
});

test('legacy records disclose that direction and totals are estimates', async ({ page }) => {
  await page.route('**/rest/v1/transactions?*', async route => {
    const response = await route.fetch();
    const rows = await response.json();
    await route.fulfill({ response, json: rows.map((row: Record<string, unknown>) => ({ ...row, direction: null })) });
  });
  await login(page);
  await expect(page.getByRole('note')).toContainText('10 older transactions in this month');
  await page.screenshot({ path: '.audit-results/mobile-redesign/after-legacy-data-warning.png' });
  await page.goto('/dashboard/history');
  await expect(page.getByRole('note')).toContainText('estimated classifications');
});

test('legacy transaction corrections update totals, filters and persisted values', async ({ page, request }) => {
  await request.post(api, { data: { scenario: 'legacy' } }); await login(page);
  await expect(page.getByRole('note')).toContainText('10 older transactions');
  await review(page,'Example rent payment');
  await expect(page.getByLabel('Payment direction',{exact:true})).toHaveValue('');
  await page.getByLabel('Payment direction',{exact:true}).selectOption('credit');
  await page.getByLabel('Category', { exact: true }).fill('Refund');
  await page.getByRole('button', { name: 'Save correction' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await go(page,'Overview'); await expect(page.getByRole('note')).toContainText('9 older transactions');
  await expect(page.getByText('£573.69', { exact: true }).first()).toBeVisible();
  await go(page,'Activity'); await page.getByLabel('Only older transactions with estimated direction').check();
  await expect(page.getByRole('button', { name: /^Review Example rent payment/ })).toHaveCount(0);
  await page.reload();
  await expect(page.getByText('+£950.00', {exact:true})).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await review(page,'Example rent payment');
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
  await page.screenshot({ path: '.audit-results/mobile-redesign/after-transaction-correction.png' });
});

test('subscription frequency can be corrected and false detections dismissed and restored', async ({ page }) => {
  await login(page); await subscription(page,'Netflix');
  await page.getByText('Edit detected payment details', { exact: true }).click();
  await page.getByLabel('Billing frequency').selectOption('annual');
  await page.getByRole('button', { name: 'Save payment details' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('£696.87', { exact: true })).toBeVisible();
  await subscription(page,'Netflix');
  await page.getByRole('button', { name: 'This is not a subscription', exact: true }).click();
  await page.getByRole('button',{name:'Dismiss detection',exact:true}).click();
  await expect(page.getByRole('button', { name: 'Manage Netflix', exact: true })).toHaveCount(0);
  await expect(page.getByText('£683.88', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Cancelled & dismissed', exact: true }).click();
  await page.getByRole('button', { name: 'Manage Netflix', exact: true }).click();
  await page.getByRole('button', { name: 'Restore as active subscription' }).click();
  await page.getByRole('button', { name: 'Active', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Manage Netflix', exact: true })).toBeVisible();
  await subscription(page,'Netflix');
  await page.getByText('Edit detected payment details', { exact: true }).click();
  await expect(page.getByLabel('Billing frequency')).toHaveValue('annual');
  await page.setViewportSize({ width: 390, height: 844 });
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
  await page.screenshot({ path: '.audit-results/mobile-redesign/after-subscription-correction.png' });
});

test('account outages show retry without a false quota-exhausted message', async ({ page, request }) => {
  await request.post(api, { data: { scenario: 'account-error' } }); await login(page);
  await expect(page.getByRole('alert')).toContainText('Your upload allowance could not be loaded');
  await page.getByRole('button', { name: 'Upload statement', exact: true }).click();
  await expect(page.getByText(/used this month/)).toHaveCount(0);
  await request.post(api, { data: { scenario: 'populated' } });
  await page.getByRole('button', { name: 'Retry account check', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Choose bank statement CSV' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry account check', exact: true })).toHaveCount(0);
});

test('expired password reset links explain the failure and offer a fresh link', async ({ page }) => {
  await page.goto('/auth?mode=recovery#error=access_denied&error_code=otp_expired');
  await expect(page.getByRole('alert')).toContainText('invalid or has expired');
  await expect(page.getByRole('button', { name: 'Save new password' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Forgot password?' }).click();
  await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeVisible();
  await page.getByLabel('Email', { exact: true }).fill('audit@example.test');
  await page.getByRole('button', { name: 'Send reset link' }).click();
  await expect(page.getByRole('status')).toContainText('you will receive a password reset link');
});

test('pricing cannot mistake a failed account lookup for the free plan', async ({ page }) => {
  await login(page);
  await page.route('**/rest/v1/profiles?*', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"Synthetic outage"}' }));
  await page.goto('/pricing');
  await expect(page.getByRole('alert')).toContainText('Your current plan could not be checked');
  const retry = page.getByRole('button', { name: 'Retry plan check' });
  await expect(retry).toBeEnabled();
  await page.unroute('**/rest/v1/profiles?*');
  await retry.click();
  await expect(page.getByRole('button', { name: 'Current plan', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Manage billing and cancellation' })).toBeVisible();
});
test('more than 1,000 transactions are included in totals and pagination', async ({ page, request }) => {
  await request.post(api, { data: { scenario: 'large' } }); await login(page);
  await expect(page.getByText('£1,205.00', { exact: true }).first()).toBeVisible();
  await go(page,'Activity'); await expect(page.getByText('Page 1 of 49')).toBeVisible();
  await page.getByRole('button', { name: 'Next transaction page' }).click();
  await expect(page.getByText('Page 2 of 49')).toBeVisible();
});
test('service errors show retry rather than zero totals', async ({ page, request }) => {
  await request.post(api, { data: { scenario: 'error' } }); await login(page);
  await expect(page.getByRole('heading', { name: 'Your overview could not be loaded' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Money out', exact: true })).toHaveCount(0);
  await request.post(api, { data: { scenario: 'populated' } });
  await page.getByRole('button', { name: 'Try again', exact: true }).first().click();
  await expect(page.getByText('£1,523.69',{exact:true})).toBeVisible();
});
test('history uses transaction months and annual subscription costs', async ({ page }) => {
  await login(page); await page.goto('/dashboard/history'); await page.getByRole('button',{name:'Over time',exact:true}).click();
  await expect(page.getByRole('heading', { name: 'Monthly spending', exact: true })).toBeVisible();
  await expect(page.getByText('£1,676.06',{exact:true})).toBeVisible();
  await expect(page.getByText(/Coverage|incomplete/, {exact:false}).first()).toBeVisible();
  await page.screenshot({ path: '.audit-results/mobile-redesign/after-history-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: '.audit-results/mobile-redesign/after-history-mobile.png', fullPage: true });
  await page.getByLabel('From month').selectOption(month(0)); await page.getByLabel('To month').selectOption(month(-1));
  await expect(page.getByRole('alert')).toContainText('Choose an end month');
});
test('cancellation updates subscriptions without modifying past spending', async ({ page }) => {
  await login(page); await subscription(page,'Netflix');
  await expect(page.getByRole('dialog')).toContainText('Casher cannot cancel payments for you');
  await page.getByRole('button', { name: 'I cancelled with the provider' }).click();
  await page.getByRole('button',{name:'Mark as cancelled',exact:true}).click();
  await expect(page.getByRole('button', { name: 'Manage Netflix', exact: true })).toHaveCount(0);
  await expect(page.getByText('£683.88', { exact: true })).toBeVisible();
  await go(page,'Overview'); await expect(page.getByText('£1,523.69', { exact: true }).first()).toBeVisible();
});
test('savings goals can be created, updated and safely dismissed before deletion', async ({ page }) => {
  await login(page); await go(page,'Goals'); await page.getByRole('button', { name: 'Add goal', exact: true }).click();
  await page.getByLabel('Goal title').fill('Emergency fund'); await page.getByLabel('Target amount (£)', { exact: true }).fill('1000'); await page.getByLabel('Already saved (£)').fill('200'); await page.getByRole('button', { name: 'Save goal', exact: true }).click();
  await expect(page.getByText('£200.00 of £1,000.00', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Update progress', exact: true }).click(); await page.getByLabel('Already saved (£)').fill('350'); await page.getByRole('button', { name: 'Save goal', exact: true }).click();
  await expect(page.getByText('35% complete', { exact: true })).toBeVisible();
  await expect(page.getByRole('progressbar', { name: 'Emergency fund: 35% complete' })).toHaveAttribute('aria-valuenow', '35');
  await page.getByRole('button', { name: 'Delete', exact: true }).click(); await page.getByRole('button', { name: 'Keep goal' }).click();
  await expect(page.getByText('Emergency fund', { exact: true })).toBeVisible();
});
test('sign-up correctly asks for email confirmation; recovery is reachable', async ({ page }) => {
  await page.goto('/auth'); await page.getByRole('button', { name: 'Create an account', exact: true }).click();
  await page.getByLabel('Email', { exact: true }).fill('new@example.test'); await page.getByLabel('Password', { exact: true }).fill('synthetic-only'); await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Check your email'); await expect(page).toHaveURL(/auth/);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click(); await page.getByRole('button', { name: 'Forgot password?' }).click(); await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeVisible();
});
test('public routes render on narrow mobile with no overflow', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  for (const route of ['/', '/auth', '/pricing', '/about', '/privacy', '/missing-page']) {
    await page.goto(route); await expect(page.locator('h1').first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), route).toBe(true);
    await page.screenshot({ path: `.audit-results/mobile-redesign/after-public-${route.replaceAll('/', '') || 'home'}-320.png`, fullPage: true });
  }
});
test('ordinary users cannot open admin', async ({ page }) => {
  await login(page); await page.goto('/admin'); await expect(page).toHaveURL(/dashboard$/);
});

test('first import is discoverable and invalid files produce an actionable error', async ({ page, request }) => {
  await request.post(api, { data: { scenario: 'empty' } });
  await page.setViewportSize({ width: 390, height: 844 }); await login(page);
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your money, made clearer.' })).toBeVisible();
  await page.screenshot({ path: '.audit-results/mobile-redesign/after-empty-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Import a statement', exact: true }).click();
  await page.locator('input[type=file]').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('not a statement') });
  await expect(page.getByRole('alert')).toContainText('Choose one CSV file');
  await page.locator('input[type=file]').setInputFiles({ name: 'bad-statement.csv', mimeType: 'text/csv', buffer: Buffer.from('not,a,statement') });
  await page.getByRole('button', { name: 'Review statement', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('CSV');
  await page.screenshot({ path: '.audit-results/mobile-redesign/after-import-error-mobile.png', fullPage: true });
});

test('dark dashboard and mobile goal dialog remain accessible', async ({ page }) => {
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.setViewportSize({ width: 390, height: 844 }); await login(page);
  await page.getByRole('link',{name:'Account',exact:true}).click(); await page.getByRole('button',{name:/Appearance: Original light/}).click();
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => ({target:n.target,summary:n.failureSummary})) }))).toEqual([]);
  await page.screenshot({ path: '.audit-results/mobile-redesign/after-dark-mobile.png', fullPage: true });
  await go(page,'Goals'); await page.getByRole('button', { name: 'Add goal', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => ({target:n.target,summary:n.failureSummary})) }))).toEqual([]);
  await page.screenshot({ path: '.audit-results/mobile-redesign/after-goal-dialog-mobile.png' });
});


test('iPhone charts have explicit amounts, safe provider links and usable month controls', async ({page})=>{
  await page.setViewportSize({width:393,height:852}); await login(page);
  const monthBox=await page.getByLabel('Statement month').boundingBox(); expect(monthBox!.height).toBeGreaterThanOrEqual(44);
  await page.getByRole('link',{name:'Charts & insights',exact:true}).click();
  await expect(page.getByRole('list',{name:'Money out by category'}).getByText('£950.00',{exact:false})).toBeVisible();
  await subscription(page,'Netflix');
  await expect(page.getByRole('link',{name:/Continue to Netflix/})).toHaveAttribute('href','https://www.netflix.com/cancelplan');
  await expect(page.getByLabel('Amount per payment (£)')).not.toBeVisible(); await page.keyboard.press('Escape');
  await page.goto('/dashboard/history'); await page.getByRole('button',{name:'Over time',exact:true}).click();
  const from=await page.getByLabel('From month').boundingBox(); const to=await page.getByLabel('To month').boundingBox();
  expect(to!.y).toBeGreaterThan(from!.y+from!.height+8); expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('same-user navigation reuses loaded account/data; sign-out clears it', async ({ page, request }) => {
  const accountRequests: string[] = [];
  page.on('request', req => { if (/\/(get_upload_usage|check-subscription)(\?|$)/.test(req.url())) accountRequests.push(req.url()); });
  await login(page);
  await expect(page.getByRole('list',{name:'Money out by category'})).toBeVisible();
  await expect.poll(() => accountRequests.length).toBe(3);
  const initial = accountRequests.length;
  await page.getByRole('link',{name:'Charts & insights',exact:true}).click();
  await expect(page.getByRole('heading', {name:'Charts & insights'})).toBeVisible();
  await page.getByRole('link', {name:'Back to overview'}).click();
  await expect(page.getByRole('list',{name:'Money out by category'})).toBeVisible();
  expect(accountRequests.length).toBe(initial);
  await page.getByRole('link',{name:'Account',exact:true}).click(); await page.getByRole('button', {name:'Sign out',exact:true}).click();
  await expect(page).toHaveURL(/auth$/);
  await request.post(api, {data:{scenario:'empty'}});
  await login(page);
  await page.getByRole('dialog', {name:'Welcome to Casher!'}).getByRole('button', {name:'Close',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Your money, made clearer.'})).toBeVisible();
  await expect(page.getByRole('cell', {name:'Example rent payment',exact:true})).toHaveCount(0);
});

test('phone transactions show full amounts and a readable empty search without sideways scrolling', async ({page}) => {
  await page.setViewportSize({width:390,height:844}); await login(page);
  await go(page,'Activity'); const rows=page.getByRole('list',{name:'Transactions',exact:true});
  await expect(rows.first()).toBeVisible();
  await expect(rows.getByRole('listitem')).toHaveCount(10);
  expect(await rows.first().evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  await expect(rows.getByRole('button',{name:/Review/}).first()).toBeVisible();
  await page.getByRole('textbox',{name:'Search transactions'}).fill('no-such-payment');
  const empty=page.getByText('No transactions match your search.');
  await expect(empty).toBeVisible();
  const bounds=await empty.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0); expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(390);
});
