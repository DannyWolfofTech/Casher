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

test('a failed native connection asks for a fresh link without falsely claiming expiry', async ({ page }) => {
  await page.goto('/auth?error=connection');
  await expect(page.getByRole('alert')).toHaveText('Could not connect to Casher to complete this link. Check your connection and request a new link on this device.');
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Forgot password?', exact: true })).toBeVisible();
  await expect(page.getByText(/invalid or has expired/)).toHaveCount(0);
});

test('a connection failure leaves the auth form ready for a clear manual retry', async ({ page }) => {
  await page.route('**/auth/v1/token?grant_type=password', route => route.abort('failed'));
  await page.goto('/auth');
  await page.getByLabel('Email', { exact: true }).fill('audit@example.test');
  await page.getByLabel('Password', { exact: true }).fill('synthetic-only');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Could not connect to Casher. Check your connection and try again.');
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeEnabled();
});

test('email throttling explains the limit without claiming that a message was sent', async ({ page }) => {
  await page.route('**/auth/v1/signup**', route => route.fulfill({ status: 429, contentType: 'application/json', headers: { 'x-supabase-api-version': '2024-01-01' }, body: JSON.stringify({ code: 'over_email_send_rate_limit', msg: 'email rate limit exceeded' }) }));
  await page.goto('/auth');
  await page.getByRole('button', { name: 'Create an account', exact: true }).click();
  await page.getByLabel('Email', { exact: true }).fill('audit@example.test');
  await page.getByLabel('Password', { exact: true }).fill('synthetic-only');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Email requests are temporarily limited.');
  await expect(page.getByText('Check your email to confirm your account before signing in.')).toHaveCount(0);
});
