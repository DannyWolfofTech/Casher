import { test, expect } from '@playwright/test';

test('browser email return offers the app handoff without trying to redeem its code', async ({ page }) => {
  const exchanges: string[] = [];
  page.on('request', request => { if (request.url().includes('grant_type=pkce')) exchanges.push(request.url()); });
  await page.goto('/auth?code=one-use-device-code&mode=recovery');
  await expect(page.getByRole('heading', { name: 'Continue in Casher' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open Casher', exact: true })).toHaveAttribute('href', 'com.trycasher.app:/auth?code=one-use-device-code&mode=recovery');
  await expect(page.getByText(/resetting your password/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save new password' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Back to website sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  expect(exchanges).toEqual([]);
});

test('malformed callbacks never become app links', async ({ page }) => {
  await page.goto('/auth?code=a&code=b');
  await expect(page.getByRole('link', { name: 'Open Casher', exact: true })).toHaveCount(0);
});
