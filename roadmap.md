# Casher roadmap

## Done
- [x] Phase B: shared CSV parser (`supabase/functions/_shared/csv-parser.ts`) with UK dates, signed amounts, debit/credit direction, in-file dedupe.
- [x] Phase A contract: shared quota layer (`supabase/functions/_shared/quota.ts`).
- [x] `process-csv` rewritten: structured status codes, server-side quota reserve/release, replay detection, sign-preserving + legacy dedupe, server-written upload history.
- [x] Client no longer writes upload counter, reset date, or upload history (`useAuth`, `Dashboard`, `CSVUpload`).
- [x] Debit/credit-aware display helpers (`src/lib/transactions.ts`) used by dashboard, chart, and transactions table; legacy null-direction rows still count as spending.
- [x] Tests: real shared-parser tests, quota concurrency tests, direction-helper tests (72 passing).
- [x] Fix preview typecheck errors in `src/lib/__tests__/csv-parser.test.ts`.

## Open
- [ ] Apply the Phase A migration `db/pending/20260904103700_entitlement_protection_and_upload_quota.sql`.
      Until it runs, the paywall is enforced only in the edge function — the `profiles` RLS policy still
      allows a client to change `subscription_tier`. The edge function and `useAuth` both fall back safely
      while the SQL is unapplied.
