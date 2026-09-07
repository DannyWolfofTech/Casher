# Retired release tooling

These text snapshots are excluded from application builds, migration discovery and tests.

- `Admin.tsx.txt`: unused referral administration with estimated revenue and no implemented referral reward system. The old `/admin` URL now redirects to the dashboard. Database role and referral records remain intact.
- `verify.ts.txt`, `capture-server.ts.txt`, `import-map.json.txt`: the early in-memory Supabase adapter used by the historical Stripe verification notes. It does not exercise current server-owned database operations. Use `tools/billing-sandbox/verify-supabase.mjs` against isolated real Supabase instead.

Do not treat historical passes from these snapshots as acceptance of the current release.
