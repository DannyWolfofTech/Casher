# Casher

Casher imports GBP statements, shows spending by transaction month, and identifies possible recurring payments. It uses React, TypeScript, Vite, Supabase and Stripe. Bank connections and Premium features remain in development.

## Start with the audit

The [September 2026 audit](docs/design-audit/README.md) contains findings, screenshots, verification evidence and release gates. Passing local checks does not certify the live backend, billing or email service.

## Install and verify

Use npm and package-lock.json for the reproducible verification workflow. Node 26.4 / npm 11.17 were used here; CI uses Node 26. The Bun lock is maintained for Lovable compatibility; npm is the tested install path.

    npm ci
    npm run check
    npx playwright install chromium
    npm run test:browser

The check script runs TypeScript, ESLint, unit/PostgreSQL tests and the production build. Browser tests start an isolated local backend with invented records.

## Safe local preview

    npm run dev:audit

Open http://127.0.0.1:8080 and sign in as audit@example.test using any test password of at least 6 characters. Data is synthetic and resets when the server restarts. Ports 8080 and 54329 must be free. This loopback-only server must never be deployed.

To use a real development backend, copy .env.example to .env.local, enter a staging Supabase URL and public key, then run npm run dev. Keep backend secrets in Supabase Edge Function secrets; never put them in VITE_ variables. Lovable may overwrite its generated client.

## Backend deployment

Apply supabase/migrations/20260904220000_atomic_statement_import.sql and then supabase/migrations/20260904230000_statement_corrections.sql after all earlier migrations, first to staging. Deploy process-csv, check-subscription, create-checkout-session, customer-portal and stripe-webhook with their shared modules and function configuration. Publish the frontend after staging acceptance. If the atomic import function is absent, the importer fails safely.

Billing requires STRIPE_SECRET_KEY_CUSTOM, STRIPE_WEBHOOK_SECRET and a configured Stripe customer portal with cancellation enabled. Supabase provides SUPABASE_URL and server-role credentials. ALLOWED_REDIRECT_ORIGINS must contain only trusted exact origins. Reconcile legacy Stripe customers before rollout: an email match alone no longer grants billing access.

With Deno 2, check the changed edge functions:

    deno check --frozen supabase/functions/process-csv/index.ts supabase/functions/check-subscription/index.ts supabase/functions/create-checkout-session/index.ts supabase/functions/customer-portal/index.ts supabase/functions/stripe-webhook/index.ts

## Correcting records

In the transaction table, use **Correct** to confirm payment direction and category against the original statement. The review-only filter identifies legacy rows with unknown direction. Corrections update dashboard/history totals and exports while preserving the imported amount, date and description. Correction history is private to the account; stale concurrent edits are rejected.

Subscription review supports correcting payment amount/frequency, dismissing false detections, marking confirmed cancellations and restoring records. New imports keep explicit payment corrections and inactive statuses. These actions do not cancel a provider contract.

The source is connected to DannyWolfofTech/Casher and changes are prepared on codex/production-hardening. Review the [release checklist](docs/design-audit/README.md#release-gates) before publishing. Production migrations and billing/email acceptance must precede frontend rollout.
