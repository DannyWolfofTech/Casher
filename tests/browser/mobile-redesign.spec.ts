import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const api = 'http://127.0.0.1:54329/__audit/state';
async function login(page: Page) {
  await page.goto('/auth');
  await page.getByLabel('Email', {exact:true}).fill('audit@example.test');
  await page.getByLabel('Password', {exact:true}).fill('synthetic-only');
  await page.getByRole('button', {name:'Sign in',exact:true}).click();
  await expect(page).toHaveURL(/dashboard$/);
}
async function tab(page: Page, name: string) { await page.getByRole('navigation', {name:'Main navigation'}).getByRole('link', {name,exact:true}).click(); }
test.beforeEach(async ({request}) => { await request.post(api, {data:{scenario:'populated'}}); });
for (const width of [320,393,768,1440]) {
  test(`complete redesigned app fits ${width}px`, async ({page}) => {
    test.setTimeout(90000);
    await page.setViewportSize({width,height:852}); await login(page);
    for (const name of ['Overview','Activity','Subscriptions','Goals']) {
      await tab(page,name);
      await expect(page.getByRole('heading',{level:1,name,exact:true})).toHaveCount(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const violations=(await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations;
      expect(violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);
      await page.screenshot({animations:'disabled',path:`.audit-results/mobile-redesign/${name.toLowerCase()}-${width}.png`});
    }
    await tab(page,'Overview'); await page.getByRole('link',{name:'Charts & insights',exact:true}).click();
    await expect(page.getByRole('list',{name:'Money out by category'}).locator('li')).toHaveCount(9);
    await page.screenshot({animations:'disabled',path:`.audit-results/mobile-redesign/categories-${width}.png`});
    await page.getByRole('button',{name:'Over time',exact:true}).click();
    await expect(page.getByRole('region',{name:/Monthly spending chart/})).toBeVisible();
    await page.screenshot({animations:'disabled',path:`.audit-results/mobile-redesign/monthly-${width}.png`});
    await page.getByRole('link',{name:'Account',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Account',exact:true})).toBeVisible();
    await page.screenshot({animations:'disabled',path:`.audit-results/mobile-redesign/account-${width}.png`});
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
test('activity filters, signs and search survive tab changes', async ({page}) => {
  await login(page); await tab(page,'Activity');
  await page.getByRole('button',{name:'Money in',exact:true}).click();
  await expect(page.getByRole('button',{name:/Review Example salary/})).toBeVisible();
  await expect(page.getByRole('button',{name:/Review Example rent/})).toHaveCount(0);
  await page.getByRole('button',{name:'Money out',exact:true}).click();
  await page.getByLabel('Search transactions').fill('rent');
  await expect(page.getByText('-£950.00',{exact:true})).toBeVisible();
  await tab(page,'Subscriptions'); await tab(page,'Activity');
  await expect(page.getByLabel('Search transactions')).toHaveValue('rent');
  await expect(page.getByRole('button',{name:'Money out',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:/Review Example rent/}).click();
  await expect(page.getByRole('dialog')).toContainText('Original statement description');
  await expect(page.getByLabel('Payment direction', {exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Edit transaction',exact:true}).click();
  await expect(page.getByLabel('Payment direction', {exact:true})).toHaveValue('debit');
});
test('preview never sends the statement before explicit confirmation', async ({page}) => {
  let writes=0; await page.route('**/functions/v1/process-csv',async route=>{writes++;await route.fulfill({json:{code:'OK',transactionsCount:2,subscriptionsCount:0}});});
  await login(page); await page.getByRole('button',{name:'Upload statement',exact:true}).click();
  await page.locator('input[type=file]').setInputFiles({name:'synthetic.csv',mimeType:'text/csv',buffer:Buffer.from('Date,Description,Amount\n2026-09-02,TESCO,-43.20\n2026-09-02,Salary,3200.00')});
  await page.getByRole('button',{name:'Review statement',exact:true}).click();
  await expect(page.getByRole('region',{name:'Statement preview'})).toContainText('2 readable transactions');
  expect(writes).toBe(0);
  await page.getByRole('button',{name:'Confirm import',exact:true}).click();
  await expect(page.getByText('2 transactions imported.',{exact:true})).toBeVisible(); expect(writes).toBe(1);
});
test('first-use example is clearly labelled and never writes account data', async ({page,request}) => {
  await request.post(api,{data:{scenario:'empty'}});
  let writes=0;
  page.on('request',req => { if (req.url().includes('54329') && /POST|PATCH|DELETE/.test(req.method()) && !req.url().includes('/auth/') && !req.url().endsWith('/rpc/get_upload_usage')) writes++; });
  await page.setViewportSize({width:393,height:852}); await login(page);
  await page.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).click();
  await page.getByRole('button',{name:'Explore an example',exact:true}).click();
  await expect(page.getByRole('dialog')).toContainText('Invented example data');
  await expect(page.getByRole('dialog')).toContainText('£1,523.69');
  await page.getByRole('button',{name:'All categories',exact:true}).click();
  await expect(page.getByRole('list',{name:'Money out by category'}).locator('li')).toHaveCount(4);
  await page.getByRole('button',{name:'Close',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Your money, made clearer.'})).toBeVisible();
  expect(writes).toBe(0);
});
for (const dark of [false,true]) {
  test(`auth and account remain usable at large text in ${dark?'dark':'light'} mode`, async ({page})=>{
    test.setTimeout(90000); await page.setViewportSize({width:320,height:852});
    await page.addInitScript(dark=>{localStorage.setItem('theme',dark?'dark':'light');document.documentElement.style.fontSize='24px';},dark);
    await page.goto('/auth');
    await page.screenshot({animations:'disabled',path:`.audit-results/mobile-redesign/auth-${dark?'dark':'light'}.png`});
    expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
    await login(page); await tab(page,'Activity');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('link',{name:'Account',exact:true}).click();
    await page.getByRole('link',{name:/Statements & data/}).click();
    await page.getByRole('button',{name:'Clear statement data',exact:true}).click();
    await expect(page.getByRole('button',{name:'Permanently clear statement data'})).toBeDisabled();
    expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
  });
}
