// Retired: authentication email delivery uses auth-email-hook and the queue.
// Keeping the old URL explicitly closed prevents an older deployment being callable.
Deno.serve(() => Response.json({error:'This email endpoint has been retired.'},{status:410,headers:{'Cache-Control':'no-store'}}));
