// No keys, response bodies, customer records or payment mutations are written to output.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const env = Object.fromEntries(readFileSync('.env', 'utf8').split(/\r?\n/).map(line => line.match(/^([A-Z_]+)=["']?(.*?)["']?$/)).filter(Boolean).map(m => [m[1], m[2]]));
const base = env.VITE_SUPABASE_URL;
if (base !== 'https://ewnjmvxildwmbdmosasz.supabase.co') throw new Error('Unexpected project; refusing checks');
const results = [];
for (const path of ['/', '/pricing', '/privacy', '/auth']) {
  const response = await fetch(`https://trycasher.com${path}`, { signal: AbortSignal.timeout(20000) });
  results.push({ check: `HTTPS ${path}`, status: response.status, passed: response.ok });
}
for (const endpoint of ['create-checkout', 'create-checkout-session', 'customer-portal', 'check-subscription']) {
  const response = await fetch(`${base}/functions/v1/${endpoint}`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ tier:'pro' }), signal: AbortSignal.timeout(20000) });
  results.push({ check: `${endpoint} rejects unauthenticated requests`, status: response.status, passed: [401,403].includes(response.status) });
}
const webhook = await fetch(`${base}/functions/v1/stripe-webhook`, { method:'POST', headers:{'Content-Type':'application/json','stripe-signature':'t=0,v1=invalid'},body:'{}',signal:AbortSignal.timeout(20000) });
results.push({check:'webhook rejects invalid signature',status:webhook.status,passed:webhook.status === 400});
mkdirSync('.audit-results', {recursive:true});
writeFileSync('.audit-results/live-readonly-20260907.json', JSON.stringify({checkedAt:new Date().toISOString(),results},null,2));
console.log(JSON.stringify(results,null,2));
if (results.some(r => !r.passed)) process.exitCode=1;
