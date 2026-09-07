// Make an ignored copy of the existing edge functions with only Stripe's HTTP
// transport changed. Production code/configuration are never patched in place.
import assert from 'node:assert/strict';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { privateDirectory } from './private-directory.mjs';

const state = JSON.parse(await readFile('.audit-results/stripe-transport/private-state.json', 'utf8'));
assert.equal(state.account, 'acct_1SCrpvJMS012Ip2A');
assert.equal(state.livemode, false);
assert.equal(state.url, 'http://127.0.0.1:18771');
const target = resolve('.audit-results/stripe-workspace');
await privateDirectory(target);
await mkdir(`${target}/supabase`, { recursive: true });
await cp('supabase/functions', `${target}/supabase/functions`, { recursive: true });
await cp('supabase/config.toml', `${target}/supabase/config.toml`);
await cp('deno.lock', `${target}/deno.lock`);
const shared = `${target}/supabase/functions/_shared`;
let billing = await readFile(`${shared}/billing.ts`, 'utf8');
const transport = 'httpClient: Stripe.createFetchHttpClient()';
assert.equal(billing.split(transport).length, 2, 'Expected exactly one Stripe transport construction');
billing = "import { cliFetch } from './cli-fetch.ts';\n" + billing.replace(transport, 'httpClient: Stripe.createFetchHttpClient(cliFetch)');
await writeFile(`${shared}/billing.ts`, billing);
await writeFile(`${shared}/cli-fetch.ts`, `// Acceptance-only transport; this file is never deployed.
export const cliFetch: typeof fetch = async (input, init) => {
  const original = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
  if (original.origin !== 'https://api.stripe.com') throw new Error('Unexpected Stripe destination');
  const headers = new Headers(init?.headers);
  headers.set('Authorization', 'Bearer ' + Deno.env.get('STRIPE_CLI_BRIDGE_TOKEN'));
  return fetch('http://host.docker.internal:18771' + original.pathname + original.search, { ...init, headers });
};
`);
await writeFile(`${target}/edge.env`, [
  'LOVABLE_API_KEY=casher-local-email-fixture',
  'ALLOWED_REDIRECT_ORIGINS=http://localhost:8080',
  // A non-credential marker satisfies the unchanged mode guard. It is never
  // used with Stripe: the private official CLI authenticates every request.
  'STRIPE_SECRET_KEY_CUSTOM=sk_test_cli_transport',
  'STRIPE_MODE=test',
  `STRIPE_ACCOUNT_ID=${state.account}`,
  `STRIPE_PRO_PRICE_ID=${state.price}`,
  `STRIPE_CLI_BRIDGE_TOKEN=${state.token}`,
  `STRIPE_WEBHOOK_SECRET=${state.webhookSecret}`,
  '',
].join('\n'), { mode: 0o600 });
console.log('Isolated edge copy prepared. Production source unchanged; only SDK HTTP transport differs.');
