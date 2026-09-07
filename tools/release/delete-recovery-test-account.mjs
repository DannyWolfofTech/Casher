// Cleanup for the explicitly provisioned release recovery identity only.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createClient} from '@supabase/supabase-js';
const identity=JSON.parse(await readFile('.audit-results/recovery-test-user.json','utf8'));
assert(/^privacy\+release-[0-9a-f-]{36}@trycasher\.com$/.test(identity.email));
const env=Object.fromEntries((await readFile('.env','utf8')).split(/\r?\n/).filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i),l.slice(i+1).replace(/^['"]|['"]$/g,'')];}));
assert.equal(env.VITE_SUPABASE_URL,'https://ewnjmvxildwmbdmosasz.supabase.co');
const client=createClient(env.VITE_SUPABASE_URL,env.VITE_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
// Select the last password actually confirmed by the operator, not guessed retries.
const field=process.argv[2]||'password';assert(['password','newPassword','coldPassword'].includes(field));
const signed=await client.auth.signInWithPassword({email:identity.email,password:identity[field]});
assert.equal(signed.error,null);assert.equal(signed.data.user.user_metadata.release_test,'20260907-recovery');
const response=await client.functions.invoke('delete-account',{body:{confirmation:'DELETE'},headers:{Origin:'https://trycasher.com'}});
assert.equal(response.error,null);assert.equal(response.data.deleted,true);
assert((await client.auth.getUser(signed.data.session.access_token)).error);
await writeFile('.audit-results/recovery-cleanup.json',JSON.stringify({time:new Date().toISOString(),userId:signed.data.user.id,deleted:true,sessionRejected:true},null,2));
console.log('PASS Disposable recovery account deleted; session rejected.');
