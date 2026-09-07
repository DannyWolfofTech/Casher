// Only intentionally public browser configuration is permitted here.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const config=JSON.parse(await readFile(new URL('./production-public-config.json',import.meta.url),'utf8'));
assert.equal(config.supabaseUrl,'https://ewnjmvxildwmbdmosasz.supabase.co');
if(!config.supabasePublishableKey.startsWith('sb_publishable_')){
  const payload=JSON.parse(Buffer.from(config.supabasePublishableKey.split('.')[1],'base64url').toString());
  assert.equal(payload.role,'anon','A service/secret key must never be included in a native app');
  assert.equal(payload.ref,'ewnjmvxildwmbdmosasz');
}
assert(!/[\r\n]/.test(config.supabasePublishableKey));
await writeFile('.env.production.local',`VITE_SUPABASE_URL=${config.supabaseUrl}\nVITE_SUPABASE_PUBLISHABLE_KEY=${config.supabasePublishableKey}\n`);
await mkdir('.audit-results',{recursive:true});
console.log('Prepared the production public configuration; no server credentials are used.');
