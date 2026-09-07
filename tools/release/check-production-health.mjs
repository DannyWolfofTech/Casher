// Read-only checks using public configuration. Never creates accounts, email or payments.
import assert from 'node:assert/strict';
import {readFile,appendFile} from 'node:fs/promises';
const config=JSON.parse(await readFile(new URL('../mobile/production-public-config.json',import.meta.url),'utf8'));
const site='https://trycasher.com';
assert.equal(config.supabaseUrl,'https://ewnjmvxildwmbdmosasz.supabase.co');
const auth={apikey:config.supabasePublishableKey,Authorization:`Bearer ${config.supabasePublishableKey}`};
const checks=[];
async function check(name,action){
  const started=Date.now();let passed=false;
  for(let attempt=0;attempt<2;attempt++){
    try{await action();passed=true;break;}catch{
      if(attempt===0)await new Promise(resolve=>setTimeout(resolve,4000));
    }
  }
  checks.push({name,passed,milliseconds:Date.now()-started});
  console.log(`${passed?'PASS':'FAIL'} ${name}`);
}
const request=(url,options={})=>fetch(url,{...options,redirect:'error',signal:AbortSignal.timeout(12000)});
await Promise.all([
  check('Website and referenced JavaScript/CSS assets',async()=>{
    const response=await request(site);assert.equal(response.status,200);assert.match(response.headers.get('content-type')||'',/text\/html/);
    const html=await response.text();assert(html.length<250000);assert.match(html,/<title>[^<]*Casher/i);
    const script=html.match(/<script[^>]+src="(\/assets\/[^"?#]+\.js)"/);
    const style=html.match(/<link[^>]+href="(\/assets\/[^"?#]+\.css)"/);
    assert(script&&style,'Production asset references missing');
    for(const path of [script[1],style[1]]){const asset=await request(new URL(path,site),{method:'HEAD'});assert.equal(asset.status,200);assert(!/text\/html/.test(asset.headers.get('content-type')||''));}
  }),
  check('Authentication service',async()=>{
    const response=await request(`${config.supabaseUrl}/auth/v1/settings`,{headers:auth});
    assert.equal(response.status,200);assert.equal((await response.json()).external.email,true);
  }),
  check('Database reachable and anonymous profile access denied',async()=>{
    const response=await request(`${config.supabaseUrl}/rest/v1/profiles?select=user_id&limit=1`,{headers:auth});
    assert.equal(response.status,200);const rows=await response.json();assert(Array.isArray(rows)&&rows.length===0);
  }),
  check('Billing function rejects an anonymous request',async()=>{
    const response=await request(`${config.supabaseUrl}/functions/v1/check-subscription`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
    assert.equal(response.status,401);
  }),
]);
if(process.env.GITHUB_STEP_SUMMARY){
  await appendFile(process.env.GITHUB_STEP_SUMMARY,`Production checked at ${new Date().toISOString()}\n\n| Check | Result | Duration |\n|---|---|---|\n${checks.map(c=>`| ${c.name} | ${c.passed?'PASS':'FAIL'} | ${c.milliseconds} ms |`).join('\n')}\n\nRead-only checks. Customer data and response bodies are never logged. This does not verify checkout, bank connectivity or restore capability.\n`);
}
if(checks.some(c=>!c.passed))process.exitCode=1;
