// Loopback-only synthetic backend. Never imports production configuration or credentials.
import http from 'node:http';
import { createServer } from 'vite';
import { user, makeFixtures } from './fixtures.mjs';
let state = makeFixtures();
let scenario = 'populated';
const port = 54329;
const token = () => `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: user.id, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.synthetic`;
const backend = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'http://127.0.0.1:8080');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Range');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') { res.end(); return; }
  const url = new URL(req.url, `http://127.0.0.1:${port}`);
  const parts = []; for await (const part of req) parts.push(part);
  let body = {}; try { body = JSON.parse(Buffer.concat(parts).toString() || '{}'); } catch { /* Empty request. */ }
  const send = (value, status = 200) => { res.statusCode = status; res.end(JSON.stringify(value)); };
  if (url.pathname === '/__audit/state') {
    scenario = body.scenario || 'populated'; state = makeFixtures();
    if (scenario === 'empty') for (const key of ['transactions', 'detected_subscriptions', 'upload_history']) state[key] = [];
    if (scenario === 'historical') state.transactions = state.transactions.filter(row => row.date.slice(0, 7) !== new Date().toISOString().slice(0, 7));
    if (scenario === 'large') state.transactions = Array.from({ length: 1205 }, (_, i) => ({ ...state.transactions[0], id: `large-${String(i).padStart(5, '0')}`, amount: -1 }));
    if (scenario === 'legacy') state.transactions.forEach(row => { row.direction = null; });
    return send({ scenario });
  }
  if (url.pathname === '/auth/v1/token') return send({ access_token: token(), refresh_token: 'synthetic-refresh', token_type: 'bearer', expires_in: 3600, user });
  if (url.pathname === '/auth/v1/user') return send(user);
  if (url.pathname === '/auth/v1/signup') return send({ user, session: null });
  if (url.pathname.startsWith('/auth/')) return send({});
  if (url.pathname.endsWith('/get_upload_usage')) return scenario === 'account-error' ? send({ message: 'Synthetic account outage' }, 503) : send([{ uploads_used: scenario === 'empty' ? 0 : 2, upload_limit: null, tier: 'pro' }]);
  if (url.pathname.endsWith('/check-subscription')) return send({ tier: 'pro', subscribed: true });
  if (url.pathname.endsWith('/process-csv')) return send({ code: 'INVALID_PAYLOAD', message: 'The sample statement could not be imported. Check the date, description and amount columns.' }, 422);
  if (url.pathname.endsWith('/review_transaction') || url.pathname.endsWith('/review_subscription')) {
    const transaction = url.pathname.endsWith('/review_transaction');
    const row = state[transaction ? 'transactions' : 'detected_subscriptions'].find(row => row.id === body._id && row.user_id === user.id);
    if (!row) return send({ code: '42501' }, 403);
    if ((row.reviewed_at ?? null) !== (body._expected_reviewed_at ?? null)) return send({ code: 'PT409' }, 409);
    if (transaction) Object.assign(row, { direction_override: body._direction, category_override: body._category });
    else Object.assign(row, { status: body._status, amount: body._amount, frequency: body._frequency });
    row.reviewed_at = new Date().toISOString(); return send({ id: row.id, reviewed_at: row.reviewed_at });
  }
  const table = url.pathname.split('/').pop();
  if (!(table in state)) return send({ message: 'Unsupported synthetic endpoint' }, 404);
  if (scenario === 'error' && ['transactions', 'detected_subscriptions', 'savings_goals'].includes(table)) return send({ message: 'Synthetic service outage' }, 503);
  let rows = [...state[table]];
  for (const [key, value] of url.searchParams) {
    if (['select', 'order', 'offset', 'limit', 'or'].includes(key)) continue;
    const [op, ...rest] = value.split('.'); const val = rest.join('.');
    rows = rows.filter(row => op === 'eq' ? String(row[key]) === val : op === 'gte' ? String(row[key]) >= val : op === 'lte' ? String(row[key]) <= val : op === 'lt' ? String(row[key]) < val : true);
  }
  const search = url.searchParams.get('or')?.match(/ilike\.\*?(.*?)\*?(?:,|\))/)?.[1]?.replace(/[%*"\\]/g, '');
  if (search) rows = rows.filter(row => `${row.description} ${row.category}`.toLowerCase().includes(search.toLowerCase()));
  const single = req.headers.accept?.includes('vnd.pgrst.object');
  if (req.method === 'POST') { const row = { id: crypto.randomUUID(), current_amount: 0, created_at: new Date().toISOString(), ...body }; state[table].push(row); return send(single ? row : [row], 201); }
  if (req.method === 'PATCH') { rows.forEach(row => Object.assign(row, body)); return send(single ? rows[0] || null : rows); }
  if (req.method === 'DELETE') { state[table] = state[table].filter(row => !rows.includes(row)); return send(single ? rows[0] || null : rows); }
  const order = url.searchParams.get('order');
  if (order) rows.sort((a, b) => { for (const term of order.split(',')) { const [key, direction] = term.split('.'); const diff = String(a[key]).localeCompare(String(b[key])); if (diff) return direction === 'desc' ? -diff : diff; } return 0; });
  const count = rows.length;
  const offset = Number(url.searchParams.get('offset') || 0);
  rows = rows.slice(offset, offset + Number(url.searchParams.get('limit') || 1000));
  res.setHeader('Content-Range', `${offset}-${offset + rows.length - 1}/${count}`);
  if (req.headers.accept?.includes('vnd.pgrst.object')) return send(rows[0] || null);
  send(rows);
});
backend.listen(port, '127.0.0.1');
process.env.VITE_SUPABASE_URL = 'http://127.0.0.1:8080/audit-api';
process.env.VITE_SUPABASE_PUBLISHABLE_KEY = 'synthetic-audit-key';
const vite = await createServer({ server: { host: '127.0.0.1', port: 8080, strictPort: true, proxy: { '/audit-api': { target: `http://127.0.0.1:${port}`, rewrite: path => path.replace(/^\/audit-api/, '') } } } });
await vite.listen();
console.log('Synthetic Casher audit: http://127.0.0.1:8080 — sign in as audit@example.test with any 6+ character test password.');
const close = async () => { await vite.close(); backend.close(); process.exit(0); };
process.on('SIGINT', close); process.on('SIGTERM', close);
