import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // Explicit bridge fixture for JS policy tests, never device/storage acceptance.
  // sessionStorage here stands in for an OS vault across document reloads.
  await page.addInitScript(() => {
    Object.assign(window, { androidBridge: {}, Capacitor: {
      PluginHeaders: [
        {name:'SecureStorage',methods:['internalGetItem','internalSetItem','internalRemoveItem','setSynchronizeKeychain'].map(name=>({name,rtype:'promise'}))},
        {name:'App',methods:[...['getState','getLaunchUrl','removeListener','minimizeApp'].map(name=>({name,rtype:'promise'})),{name:'addListener',rtype:'callback'}]},
      ],
      nativePromise:async(plugin:string,method:string,args:Record<string,string>)=>{
        if(plugin==='App') return method==='getState'?{isActive:true}:{};
        const key=`fixture-vault:${args?.prefixedKey}`;
        if(method==='internalGetItem') return {data:sessionStorage.getItem(key)};
        if(method==='internalSetItem') {sessionStorage.setItem(key,args.data);return {};}
        if(method==='internalRemoveItem') {sessionStorage.removeItem(key);return {success:true};}
        return {};
      },
      nativeCallback:()=>crypto.randomUUID(),
    }});
  });
});

test('native email session survives reload using the vault bridge and avoids web localStorage', async ({ page }) => {
  await page.goto('/auth');
  await expect(page.getByRole('button', {name:'Continue with Google'})).toHaveCount(0);
  await expect(page.getByText(/secure storage/)).toBeVisible();
  await page.getByLabel('Email', {exact:true}).fill('audit@example.test');
  await page.getByLabel('Password', {exact:true}).fill('synthetic-only');
  await page.getByRole('button', {name:'Sign in',exact:true}).click();
  await expect(page).toHaveURL(/dashboard$/);
  const stored = await page.evaluate(() => JSON.stringify({...localStorage}));
  expect(stored).not.toContain('synthetic-refresh');
  await page.reload();
  await expect(page).toHaveURL(/dashboard$/);
});

test('native recovery uses the HTTPS website instead of an app-local URL', async ({ page }) => {
  await page.goto('/auth');
  await page.getByRole('button', {name:'Forgot password?'}).click();
  await page.getByLabel('Email', {exact:true}).fill('audit@example.test');
  const request = page.waitForRequest(r => r.url().includes('/auth/v1/recover'));
  await page.getByRole('button', {name:'Send reset link'}).click();
  expect(new URL((await request).url()).searchParams.get('redirect_to')).toBe('https://trycasher.com/auth?mode=recovery');
});
