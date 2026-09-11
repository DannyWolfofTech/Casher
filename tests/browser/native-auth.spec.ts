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
        if(method==='internalGetItem' && (window as unknown as {failNextVaultRead?:boolean}).failNextVaultRead) { Object.assign(window,{failNextVaultRead:false}); throw new Error('Synthetic vault failure'); }
        if(method==='internalGetItem') return {data:sessionStorage.getItem(key)};
        if(method==='internalSetItem') {sessionStorage.setItem(key,args.data);return {};}
        if(method==='internalRemoveItem') {sessionStorage.removeItem(key);return {success:true};}
        return {};
      },
      nativeCallback:(plugin:string,method:string,args:{eventName?:string},callback:(data:{url:string})=>void)=>{
        if (plugin==='App' && method==='addListener' && args.eventName==='appUrlOpen') Object.assign(window,{casherTestAppUrl:callback});
        return crypto.randomUUID();
      },
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


for (const failure of ['network', 'invalid'] as const) {
  test(`native recovery shows progress then exits recovery on ${failure} failure`, async ({ page }) => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/auth/v1/token?grant_type=pkce', async route => {
      await gate;
      if (failure === 'network') await route.abort('failed');
      else await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error_code: 'flow_state_expired', msg: 'Flow expired' }) });
    });
    await page.goto('/auth');
    await page.getByRole('button', {name:'Forgot password?'}).click();
    await page.getByLabel('Email', {exact:true}).fill('audit@example.test');
    await page.getByRole('button', {name:'Send reset link'}).click();
    await expect(page.getByRole('status')).toContainText('If an account exists');
    await page.evaluate(() => (window as unknown as {casherTestAppUrl:(data:{url:string})=>void}).casherTestAppUrl({url:'com.trycasher.app:/auth?code=synthetic-recovery&mode=recovery'}));
    await expect(page.getByRole('status')).toHaveText('Checking your email link…');
    await expect(page.getByRole('button', {name:'Save new password'})).toBeDisabled();
    await expect(page.getByRole('alert')).toHaveCount(0);
    release();
    await expect(page.getByRole('heading', {name:'Welcome back'})).toBeVisible();
    await expect(page.getByRole('alert')).toContainText(failure === 'network' ? 'Could not connect to Casher' : 'This sign-in link is invalid or has expired');
    await expect(page.getByRole('button', {name:'Save new password'})).toHaveCount(0);
    await page.getByRole('button', {name:'Forgot password?'}).click();
    await expect(page.getByRole('button', {name:'Send reset link'})).toBeEnabled();
  });
}


test('native recovery enables saving only after its session exchange completes', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/auth/v1/token?grant_type=pkce', async route => { await gate; await route.continue(); });
  await page.goto('/auth');
  await page.getByRole('button', {name:'Forgot password?'}).click();
  await page.getByLabel('Email', {exact:true}).fill('audit@example.test');
  await page.getByRole('button', {name:'Send reset link'}).click();
  await expect(page.getByRole('status')).toContainText('If an account exists');
  await page.evaluate(() => (window as unknown as {casherTestAppUrl:(data:{url:string})=>void}).casherTestAppUrl({url:'com.trycasher.app:/auth?code=synthetic-recovery&mode=recovery'}));
  await expect(page.getByRole('status')).toHaveText('Checking your email link…');
  await expect(page.getByRole('button', {name:'Save new password'})).toBeDisabled();
  release();
  await expect(page.getByRole('button', {name:'Save new password'})).toBeEnabled();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page).toHaveURL(/auth\?mode=recovery$/);
});


test('a device-store exception exits link verification with usable recovery guidance', async ({ page }) => {
  await page.goto('/auth');
  await expect(page.getByRole('button', {name:'Sign in',exact:true})).toBeVisible();
  await page.evaluate(() => {
    Object.assign(window,{failNextVaultRead:true});
    (window as unknown as {casherTestAppUrl:(data:{url:string})=>void}).casherTestAppUrl({url:'com.trycasher.app:/auth?code=synthetic-unreadable&mode=recovery'});
  });
  await expect(page.getByRole('alert')).toHaveText('This link could not be completed on this device. Close and reopen Casher, then request a new link.');
  await expect(page.getByText('Checking your email link…')).toHaveCount(0);
  await expect(page.getByRole('button', {name:'Sign in',exact:true})).toBeEnabled();
  await page.getByRole('button', {name:'Forgot password?'}).click();
  await expect(page.getByRole('button', {name:'Send reset link'})).toBeEnabled();
});
