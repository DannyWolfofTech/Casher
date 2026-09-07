// Exercise the real browser SDK and ingestion service using a fresh public-page context.
// No customer session, financial record or deliberately broken production code is used.
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {mkdir, writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';

const marker = `Casher launch verification ${randomUUID()}`;
const browser = await chromium.launch();
const result = {checkedAt:new Date().toISOString(), sdkCaptured:false, privacyFilterPassed:false, ingestionAccepted:false};
try {
  const page = await browser.newPage();
  const accepted = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('No accepted Sentry error envelope observed')), 25000);
    page.on('response', async response => {
      try {
        const url = new URL(response.url());
        if (url.hostname !== 'o4511223518330880.ingest.de.sentry.io' || !url.pathname.endsWith('/envelope/')) return;
        const lines = response.request().postData()?.split('\n') ?? [];
        for (let i=1;i<lines.length-1;i++) {
          let item; try { item = JSON.parse(lines[i]); } catch { continue; }
          if(item.type !== 'event') continue;
          const event = JSON.parse(lines[i+1]);
          if (!event.exception?.values?.length) continue;
          result.sdkCaptured = true;
          assert(event.exception.values.every(value => value.value === 'An application operation failed'));
          assert(!JSON.stringify(event).includes(marker));
          for (const key of ['user','request','breadcrumbs','extra','contexts']) assert.equal(event[key], undefined);
          assert.match(event.event_id,/^[a-f0-9]{32}$/);
          result.privacyFilterPassed = true;
          result.eventId = event.event_id;
          result.httpStatus = response.status();
          assert.equal(response.status(),200);
          result.ingestionAccepted = true;
          clearTimeout(timer); resolve(); return;
        }
      } catch(error) {clearTimeout(timer); reject(error);}
    });
  });
  await page.goto('https://trycasher.com/',{waitUntil:'networkidle'});
  await page.evaluate(value => {setTimeout(() => {throw new Error(value);},0);}, marker);
  await accepted;
  console.log('PASS Actual production browser SDK captured and redacted the test error; Sentry ingestion returned 200.');
  console.log(`Owner lookup event ID: ${result.eventId}`);
} finally {
  await browser.close();
  await mkdir('.audit-results',{recursive:true});
  await writeFile('.audit-results/sentry-ingestion-20260907.json',JSON.stringify(result,null,2)+'\n');
}
