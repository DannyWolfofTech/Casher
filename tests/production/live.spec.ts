import {test,expect} from '@playwright/test';

for (const language of ['fr', 'pl']) test(`live About fits 320px in ${language}`, async ({page}) => {
  await page.addInitScript(lang => localStorage.setItem('language', lang), language);
  await page.setViewportSize({width:320,height:900});
  await page.goto('/about');
  await expect(page.locator('main')).toContainText('Stripe');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('live navigation resets the scroll position', async ({page}) => {
  await page.setViewportSize({width:390,height:700});
  await page.goto('/');
  await page.getByRole('button',{name:'View Pricing',exact:true}).click();
  await expect(page).toHaveURL(/pricing$/);
  await expect(page.getByRole('heading',{level:1,name:'Choose Your Plan'})).toBeInViewport();
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});

for(const width of [390,1440]) for(const [path,heading] of [
  ['/','Casher'],['/pricing','Choose Your Plan'],['/auth','Welcome back'],
  ['/privacy','Privacy Policy'],['/terms','Terms of Service'],['/unsubscribe','Email preferences'],
]) test(`live ${path} at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:900});
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.name));
  const response=await page.goto(path);expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading',{level:1,name:heading,exact:true})).toBeVisible();
  if(path==='/')await expect(page.getByText('Possible subscriptions, ready to review',{exact:true})).toBeVisible();
  if(path==='/pricing')await expect(page.getByRole('button',{name:'New subscriptions paused',exact:true})).toBeDisabled();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
  await page.screenshot({path:`docs/design-audit/assets/live-20260907-${path.slice(1)||'home'}-${width}.png`,fullPage:true});
});

test('Android domain association serves the actual signed release certificate',async({request})=>{
  const response=await request.get('/.well-known/assetlinks.json');expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('application/json');
  const rows=await response.json();
  expect(rows.some((r:{target:{package_name:string;sha256_cert_fingerprints:string[]}})=>r.target.package_name==='com.trycasher.app'&&r.target.sha256_cert_fingerprints.includes('84:12:1F:7D:5C:87:F1:C4:90:ED:3C:74:22:DA:EF:8F:E1:CB:63:4A:E9:D1:4F:D0:3B:52:B9:6B:C3:17:D4:B4'))).toBe(true);
});
