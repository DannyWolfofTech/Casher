// Real Stripe API requests through the official CLI's private OAuth credential.
// This module never reads the CLI config or accepts/exports an API key.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';

const execute = promisify(execFile);
export const sandboxAccount = 'acct_1SCrpvJMS012Ip2A';
export const sandboxPrice = 'price_1SYzJQJMS012Ip2AChBRKO5w';
const executable = resolve('.audit-results/stripe-cli/stripe.exe');
const credentialConfig = resolve('.audit-results/stripe-auth/config.toml');
const allowed = /^\/v1\/(?:account|prices(?:\/[^/?]+)?|customers(?:\/[^/?]+)?(?:\/search)?|subscriptions(?:\/[^/?]+)?|checkout\/sessions(?:\/[^/?]+)?(?:\/expire)?|billing_portal\/sessions|events(?:\/[^/?]+)?|payment_methods(?:\/[^/?]+)?(?:\/attach)?|invoices(?:\/[^/?]+)?(?:\/pay)?|test_helpers\/test_clocks(?:\/[^/?]+)?(?:\/advance)?)$/;

export async function stripeCliRequest(path, fields, method = fields ? 'POST' : 'GET', idempotencyKey) {
  const url = new URL(path, 'https://api.stripe.com');
  if (url.origin !== 'https://api.stripe.com' || !allowed.test(url.pathname) || !['GET', 'POST', 'DELETE'].includes(method)) throw new Error('Stripe test transport refused this operation');
  const args = [method.toLowerCase(), url.pathname, '--project-name', 'casher-launch', '--config', credentialConfig, '--color', 'off', '--stripe-version', '2025-08-27.basil', '--show-headers', '--confirm'];
  for (const [key, value] of url.searchParams) args.push('--data', `${key}=${value}`);
  for (const [key, value] of new URLSearchParams(fields ?? {})) args.push('--data', `${key}=${value}`);
  if (idempotencyKey) args.push('--idempotency', idempotencyKey);
  const env = { ...process.env };
  delete env.STRIPE_API_KEY;
  delete env.STRIPE_SECRET_KEY_CUSTOM;
  let output;
  try { output = await execute(executable, args, { env, windowsHide: true, timeout: 45000, maxBuffer: 8 * 1024 * 1024 }); }
  catch (error) {
    // The CLI may exit nonzero for a genuine provider error. Preserve only its
    // JSON response and status; never echo commands, headers or credentials.
    if (typeof error.stdout !== 'string') throw new Error('Stripe CLI transport failed');
    output = error;
  }
  const raw = `${output.stdout ?? ''}\n${output.stderr ?? ''}`;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  const status = Number(raw.match(/< HTTP (\d{3})/)?.[1]);
  if (start < 0 || end < start || !status) throw new Error('Stripe CLI returned an unsupported response');
  const body = JSON.parse(raw.slice(start, end + 1));
  if (body.livemode === true || body.data?.some?.(item => item.livemode === true)) throw new Error('Live Stripe data refused');
  if (url.pathname === '/v1/account' && body.id !== sandboxAccount) throw new Error('Unexpected Stripe account');
  return { status, body };
}

export async function verifySandbox() {
  const account = await stripeCliRequest('/v1/account');
  const price = await stripeCliRequest(`/v1/prices/${sandboxPrice}`);
  if (account.status !== 200 || account.body.id !== sandboxAccount || price.status !== 200 || price.body.livemode !== false || price.body.currency !== 'gbp' || price.body.unit_amount !== 999 || price.body.recurring?.interval !== 'month') throw new Error('Sandbox identity/price verification failed');
  return { account: sandboxAccount, price: sandboxPrice, livemode: false };
}
