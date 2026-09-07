// Loopback-only transport for the real sandbox acceptance run. Stripe responses
// and signed events come from Stripe; nothing here implements a mock provider.
import { createServer } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile, appendFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { stripeCliRequest, verifySandbox } from './stripe-cli-client.mjs';
import { privateDirectory } from './private-directory.mjs';

const verified = await verifySandbox();
const folder = resolve('.audit-results/stripe-transport');
await privateDirectory(folder);
const token = randomBytes(32).toString('hex');
const common = ['--project-name', 'casher-launch', '--config', resolve('.audit-results/stripe-auth/config.toml'), '--color', 'off'];
const cli = resolve('.audit-results/stripe-cli/stripe.exe');
const cliEnvironment = { ...process.env };
delete cliEnvironment.STRIPE_API_KEY;
delete cliEnvironment.STRIPE_SECRET_KEY_CUSTOM;
const secretResult = await promisify(execFile)(cli, ['listen', '--print-secret', ...common], { windowsHide: true, env: cliEnvironment, timeout: 45000 });
const webhookSecret = `${secretResult.stdout}\n${secretResult.stderr}`.match(/whsec_[A-Za-z0-9]+/)?.[0];
if (!webhookSecret) throw new Error('The official CLI did not provide a webhook verifier');
const state = { ...verified, token, webhookSecret, url: 'http://127.0.0.1:18771', primaryCustomer: null };
await writeFile(resolve(folder, 'private-state.json'), JSON.stringify(state), { mode: 0o600 });
const evidence = resolve(folder, 'deliveries.jsonl');
await writeFile(evidence, '');
const authorized = req => {
  const input = Buffer.from(req.headers.authorization ?? '');
  const expected = Buffer.from(`Bearer ${token}`);
  return input.length === expected.length && timingSafeEqual(input, expected);
};
const server = createServer(async (req, res) => {
  const respond = (status, value) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); };
  try {
    let body = '';
    for await (const chunk of req) { body += chunk; if (Buffer.byteLength(body) > 2 * 1024 * 1024) return respond(413, { error: 'Request too large' }); }
    if (req.url === '/stripe-events' && req.method === 'POST') {
      const event = JSON.parse(body);
      const object = event.data?.object;
      const customer = typeof object?.customer === 'string' ? object.customer : object?.customer?.id;
      // Deliberate delivery exclusion is used only for the missed-webhook test.
      // Forward the primary customer's original bytes and original signature.
      if (!state.primaryCustomer || customer !== state.primaryCustomer) return respond(200, { testDeliveryExcluded: true });
      const result = await fetch('http://127.0.0.1:54321/functions/v1/stripe-webhook', { method: 'POST', headers: { 'Content-Type': 'application/json', 'stripe-signature': req.headers['stripe-signature'] ?? '' }, body, signal: AbortSignal.timeout(45000) });
      await result.text();
      await appendFile(evidence, JSON.stringify({ id: event.id, type: event.type, status: result.status, customer, timestamp: new Date().toISOString() }) + '\n');
      return respond(result.status, { forwarded: true });
    }
    if (!authorized(req)) return respond(401, { error: 'Unauthorized test transport' });
    if (req.url === '/control' && req.method === 'POST') {
      const control = JSON.parse(body);
      if (!/^cus_[A-Za-z0-9]+$/.test(control.primaryCustomer ?? '')) return respond(400, { error: 'Customer required' });
      state.primaryCustomer = control.primaryCustomer;
      return respond(200, { configured: true });
    }
    const result = await stripeCliRequest(req.url, body || undefined, req.method, req.headers['idempotency-key']);
    respond(result.status, result.body);
  } catch { respond(502, { error: { type: 'api_error', message: 'Official Stripe CLI request failed' } }); }
});
await new Promise((resolveListen, reject) => { server.once('error', reject); server.listen(18771, '127.0.0.1', resolveListen); });
const listener = spawn(cli, ['listen', '--skip-update', '--events', 'checkout.session.completed,customer.subscription.created,customer.subscription.updated,customer.subscription.deleted,invoice.payment_failed,invoice.payment_succeeded,invoice.paid', '--forward-to', 'http://127.0.0.1:18771/stripe-events', ...common], { windowsHide: true, env: cliEnvironment, stdio: ['ignore', 'pipe', 'pipe'] });
// Drain provider output without persisting its secret or customer payloads.
listener.stdout.on('data', () => {});
listener.stderr.on('data', () => {});
listener.on('exit', code => { if (code) { console.error('Stripe webhook listener stopped'); server.close(); process.exitCode = 1; } });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { listener.kill(); server.close(); });
console.log('Verified Casher sandbox CLI transport ready on loopback; API credentials remain inside the official CLI.');
