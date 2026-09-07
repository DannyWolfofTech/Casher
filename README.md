# Casher

Casher imports GBP statements, shows spending by transaction month, and identifies possible recurring payments. It uses React, TypeScript, Vite, Supabase and Stripe. Bank connectivity and new paid subscriptions are disabled pending release acceptance.

## Current release

The CSV web app is live at https://trycasher.com. The [release acceptance table](docs/release-acceptance-20260907.md) records deployed commits, tests, artifacts, disabled features and owner-only launch gates. Use the [operations runbook](docs/operations-runbook.md) for deployment, maintenance, privacy mail and recovery; the [design audit](docs/design-audit/README.md) contains current desktop/mobile screenshots.

[TrueLayer Data V3 is selected](docs/open-banking-provider-selection.md), with provider access blocked at owner signup. The V1 experiment is archived outside the production source. [Mobile release instructions](docs/mobile-readiness.md) cover the signed Android build and hosted iOS Simulator validation. Older dated reports are historical evidence and must not override the current acceptance table.

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

## Production changes and verification

Follow the [operations runbook](docs/operations-runbook.md). The recorded production migrations and hardened edge functions are already deployed. Apply only new, reviewed migrations; never rerun recorded migrations or include archived experiments. Deploy every affected edge function and shared module before publishing dependent frontend changes. Keep live checkout and bank connectivity disabled until their acceptance gates pass.

The exact frozen Deno and clean Supabase checks are maintained in `.github/workflows/ci.yml`. `node tools/release/check-production-health.mjs` performs the same read-only availability/access checks as the independent GitHub schedule. These use only intentionally public configuration; they cannot verify billing lifecycle, bank connectivity or restoration.

Server secrets belong in Cloud secrets/Vault. Native and browser bundles may contain only the public Supabase URL and publishable/anonymous key. `tools/mobile/write-production-env.mjs` validates this public configuration before hosted iOS builds. No signing keys, test passwords or server credentials belong in Git.

## Correcting records

In the transaction table, use **Correct** to confirm payment direction and category against the original statement. The review-only filter identifies legacy rows with unknown direction. Corrections update dashboard/history totals and exports while preserving the imported amount, date and description. Correction history is private to the account; stale concurrent edits are rejected.

Subscription review supports correcting payment amount/frequency, dismissing false detections, marking confirmed cancellations and restoring records. New imports keep explicit payment corrections and inactive statuses. These actions do not cancel a provider contract.

The source is connected to DannyWolfofTech/Casher. Keep release checkpoints clean and review the current acceptance table before enabling additional production features.
