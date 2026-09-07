# Casher production operations

Reviewed 7 September 2026. Production: https://trycasher.com. Cloud project `ea77ebbb-78bd-46c4-a0c9-0ab73994a416`; Supabase project `ewnjmvxildwmbdmosasz`.

## Deployment and release gates

1. Run `npm ci`, `npm run check`, `npm run test:browser`, `npm audit --audit-level=high`, and the frozen Deno checks in `.github/workflows/ci.yml`.
2. Start isolated local Supabase and run `node tools/billing-sandbox/verify-supabase.mjs`. This executes real Auth, PostgreSQL, PostgREST and edge functions. The browser fixture suite is useful UI evidence, not evidence of production data processing.
3. Apply reviewed additive migrations transactionally, with a short lock timeout; record their exact versions/statements in `supabase_migrations.schema_migrations`. Do not rerun recorded migrations or include `experiments/` snapshots.
4. Push a clean source checkpoint to GitHub main. Confirm Lovable synced that SHA. Deploy all changed edge functions and every function importing changed `_shared` modules before publishing the frontend.
5. Publish through Lovable. Verify actual custom-domain bundle hashes, HTTPS routes, desktop/mobile flows, authenticated imports/export/deletion on a disposable test account, invalid webhook rejection and origin rules.
6. Keep `CASHER_LIVE_CHECKOUT_ENABLED` absent or `false`, and `PRO_PURCHASABLE=false`, until fresh Stripe lifecycle acceptance and legal business disclosures are complete. Premium checkout remains prohibited independently on the server. Existing billing management remains accessible.
7. Bank connectivity has no deployed endpoint, provider credential, callback or production migration. The retired V1 mock implementation is a text snapshot outside build and migration discovery.

## Environment and access

Browser configuration contains only the public Supabase URL and publishable/anonymous key. Service-role, Stripe and Lovable keys belong only in Cloud secrets/Vault. Never put them in Vite variables, artifacts, screenshots, logs or this repository. Sentry uses a public DSN; application reports remove user/request/extra/context/breadcrumb data and dynamic error messages. Replay and tracing are disabled.

Billing checks pin the exact Stripe account, live/test mode and server-selected price. Customer binding is server-owned. Account deletion and checkout share a lease; billing reconciliation uses a separate fenced lease. A durable closing flag blocks imports and checkout after cancellation/deletion has started. A failed external cancellation preserves the account for retry.

Canonical and exact project origins are allowlisted. Local development origins require explicit `ALLOWED_REDIRECT_ORIGINS`; do not add wildcards. Android/iOS local origins are restricted to `https://localhost` and `capacitor://localhost`. Origin checks supplement JWT/role/ownership checks; they do not replace them.

## Scheduled maintenance

`tools/release/enable-jobs.sql` is production-only and must follow edge deployment. It uses the existing Vault secret `email_queue_service_role_key` internally; cron commands contain no key.

| Job | Schedule (UTC) | Behavior |
|---|---|---|
| `casher-billing-reconciliation` | Every 5 minutes | At most 10 eligible Stripe customers; skips dispatch when none exist. Reads current provider state and repairs missed webhook entitlements. |
| `casher-email-queue` | Every minute | Skips empty queues, auth before app emails, retries with a bounded budget and provider idempotency. |
| `casher-webhook-health` | Every 15 minutes | Counts recent failures and stale billing; at most one aggregate owner alert daily. No customer financial records in the email. |
| `casher-operational-retention` | 03:23 daily | Purges operational retention windows and cron history. |

Read dispatch results without exposing Vault values:

```sql
SELECT m.job,m.requested_at,r.status_code,r.error_msg
FROM app_private.maintenance_runs m
LEFT JOIN net._http_response r ON r.id=m.request_id
ORDER BY m.requested_at DESC LIMIT 30;
SELECT jobname,schedule,active FROM cron.job WHERE jobname LIKE 'casher-%';
SELECT status,count(*) FROM public.email_send_log
WHERE created_at>now()-interval '24 hours' GROUP BY status;
```

An HTTP 200 queue response is not proof of email delivery. Check `email_send_log`, the dead-letter queues, Lovable delivery logs and the recipient inbox. Runtime app email omits `run_id` and uses a registered unsubscribe token; auth mail preserves the provider-issued run ID. The first production alert was received at privacy@ and forwarded to Gmail on 7 September, initially in Spam. Check Spam until delivery reputation is established. No general inbox-placement guarantee is made.

The public `/unsubscribe` page requires a deliberate confirmation. Its opaque token can suppress only that recipient. Browser roles cannot resolve a token to an address. Local suppression is enforced before app mail is dispatched; requested authentication/security mail uses its separate queue. Provider suppression is also requested. A provider-sync error is logged without the email address, while local suppression remains effective.

Failures in the same database/email provider can prevent these jobs from sending an alert. Independent GitHub checks are now configured as described below. Owner access to the existing Sentry project and delivery of GitHub failure notifications still need verification.

## Billing investigation

Billing functions were redeployed from `fbeee491d983d86ec7153faab31be2ad271f2afe` after 30/30 real sandbox acceptance checks passed. Entitlement refresh now revokes stale paid access for a deleted Stripe customer using its server-owned binding; checkout and portal retain the deleted-customer rejection. The CLI's credential was never exported. See `billing-acceptance-20260907.json` for the real-provider/local-application evidence boundary.

Production destination `we_1UCoCSJXnVWNQOUCjCigFYFj` was inspected read-only: active, correct Casher endpoint, API `2025-08-27.basil`, all seven supported subscription/checkout/invoice event types. Its signing secret was not revealed or changed. This configuration inspection does not prove a matching-secret live delivery. All seven affected functions deployed without source/configuration mutations, and production health, public browser and invalid-request boundaries passed afterward.

Check the Stripe delivery log first, then the matching `webhook_events` ID/status and current subscription. Unverified signatures are rejected before database insertion. Failed verified events return a retryable response. Replayed or out-of-order events re-read current Stripe state and cannot blindly restore an old entitlement.

Never repair billing by manually setting a paid tier. Invoke the authenticated refresh path or service-only reconciliation. Inspect `app_private.billing_sync` for failed/expired leases. A deletion in progress must finish or be investigated; do not clear its closing flag merely to unblock purchases.

Three failed records from 6 September's earlier testing triggered the first alert: two old signature-implementation failures and one sandbox checkout reconciliation failure. They were retained as evidence, not rewritten as successes. They age out of the 24-hour health window. At the pre-release production inspection there were 29 profiles, all Free, and no Stripe-bound profiles.

## Retention and deletion

- Account deletion requires a server-verified sign-in within 10 minutes and exact `DELETE` confirmation. It expires open checkout sessions, cancels active Stripe subscriptions without proration/new invoices, and then deletes Auth and owned records transactionally. A refund is a separate process.
- Uploaded CSV contents are processed transiently; saved parsed records remain until deletion. Account export is available on every plan and includes all saved profile/transaction/subscription/goal/import/review records.
- Email send logs: 30 days. Queue/archive/dead-letter payloads: one day, with shorter auth/app send TTLs. Webhook events, closed Stripe-customer tombstones and deletion UUID receipts: 90 days. Dispatch and cron history: 7 days. Suppression records remain to honor opt-outs.
- `app_private.closed_accounts` records deleted user UUIDs for restore reconciliation without storing their email or statement contents.
- Native exports use app cache and the OS share sheet. Cache files expire after an hour on the next launch/export; files the user saves into another app are outside Casher's control.

## Backups and recovery

Lovable Cloud's backups UI showed daily recovery points on 4, 5, 6 and 7 September; latest inspected point: `2026-09-07 02:46:07 UTC`. The [documented database backup model](https://docs.lovable.dev/features/database) is daily backups with roughly 14 days of retention; storage files are excluded and point-in-time recovery is not available. Treat the possible database loss window as up to a day, not zero.

A restore drill has not been performed. The owner-session support request received a reply recommending Cloud's logical export for a local drill and stating isolated Cloud restores are unsupported. The documented export limit is 5 GB; the initial `pg_database_size` was 6,652,865,683 bytes despite only 2,555,904 bytes of public/auth/app_private relations. Export has not been started. Follow-up investigation found approximately 6.64 GB in `cron.job_run_details`, mostly completed March–July operational logs. The deployed seven-day retention policy had not yet run its first daily catch-up. On 7 September, bounded catch-up began for completed cron logs older than `2026-08-31 15:00:00 UTC`, preserving recent/unfinished logs and every customer table. This enforces the existing retention policy; it is not permission to delete customer records or resize production to meet an export limit. Normal VACUUM/ANALYZE completed first; no production restore has occurred. The final maintenance/export outcome must be verified before changing recovery readiness.

`tools/release/prune-expired-cron-history.sql` is the small manual pilot batch. Larger catch-up operations use explicit run-ID ranges of at most 50,000, the same completed-before cutoff, and completion/health checks between batches. Lovable's SQL tool can return HTTP 499 while a statement is still executing: inspect active database work and committed deletion statistics before retrying. Never infer rollback from that response.

`tools/release/start-isolated-restore.ps1` prepares a disposable PostgreSQL 17 target from the installed Supabase image, with no network, no ports, no preloaded worker extensions, a read-only filesystem and memory-only database storage. It was started and its isolation verified. It has not received a production export. Its 512 MB data limit is suitable only after verifying that the actual logical restore fits; a successful empty startup is not recovery evidence. Stopping it discards its temporary data.

Do not restore production merely to test recovery. Before a real restore, freeze writes/jobs and export the current deletion UUID ledger into a protected operator-controlled location. Restore into an isolated project if the provider supports it, replay deletion receipts and reconcile every Stripe-bound customer before resuming access. Verify row counts, RLS, Auth behavior, migrations and export/import workflows. A successful fresh export drill is distinct from restoring a retained daily snapshot. The owner must approve any paid recovery environment.

Rollback source/functions to a known-good reviewed checkpoint and republish. Leave additive private tables and historical evidence intact. Do not roll back to a checkout implementation that bypasses the current sales gate or deletion lease. If a migration transaction fails, it rolls back atomically; investigate the exact failure instead of dropping production objects. If necessary, unschedule only the named Casher job after recording its current definition.

## Mailbox operation

Inbound privacy@trycasher.com is free Forward Email forwarding through two MX records and an encrypted forwarding TXT record. The personal destination is not plaintext in public DNS. Both an external owner-requested delivery test and the production maintenance alert reached that destination; both initially landed in Spam.

Ordinary Gmail replies currently reveal the Gmail sender. Outbound privacy@ SMTP and Gmail “Send mail as” are **not configured**. [SMTP2GO Free](https://www.smtp2go.com/pricing/) was checked as a no-card option (1,000/month and 200/day); the owner must create/verify the account and personally accept its terms before credentials and domain verification can be configured. Alternatively, Forward Email's outbound plan starts at $3/month and requires explicit spending approval. Do not call transactional auth/alert delivery a configured human reply mailbox.

## Owner-only launch actions

Supply a legal trading name and public business/service postal address for the Terms and Privacy Policy. Do not substitute a home address or personal phone. Stripe CLI sandbox authorization is complete; account/price verification passed without exporting its credential. Open the TrueLayer Console and accept the required terms personally; see `open-banking-provider-selection.md`. Android signing has a verified same-machine protected backup; a portable off-device backup still needs an owner recovery password. Apple Team ID, device signing and store-enrollment decisions remain with the owner; hosted simulator and unsigned iPhone SDK compilation are available without those credentials.

A later actual native password-recovery request reached a unique privacy plus alias in Inbox at 12:14 BST on 7 September. That verifies this alias's forwarding and the production auth-mail path. It does not verify native password replacement: the automated link return was blocked on safe credential handling and never dispatched. The disposable identity, queue entries and local credential file were cleaned up afterward.

## Independent production checks

`.github/workflows/production-health.yml` runs `tools/release/check-production-health.mjs` from GitHub, outside Lovable/Supabase. It checks the public site and referenced JS/CSS, Auth availability, database connectivity with anonymous profile isolation, and rejection of an anonymous billing request. It creates no accounts, mail, webhook events or payments and never logs response bodies or customer data. Each failed check is retried once after four seconds before the job fails.

The schedule is at minutes 7, 22, 37 and 52 each hour, with a manual workflow trigger and a push trigger for changes to the monitor. The first actual GitHub run passed: https://github.com/DannyWolfofTech/Casher/actions/runs/34116904108. Scheduled executions can be delayed or disabled by GitHub inactivity rules; this is not an uptime SLA. Confirm that GitHub Actions failure notifications reach an actively monitored owner destination. Sentry access and alert delivery remain separate acceptance items.

The job is guarded to the public `DannyWolfofTech/Casher` repository and uses a standard runner. It stops running if the repository becomes private, avoiding accidental private-runner charges. The iOS validation workflow has the same public-repository guard. No larger runners or new paid service are used. [GitHub billing rules](https://docs.github.com/en/billing/concepts/product-billing/github-actions) and [scheduled event behavior](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule) describe the applicable limits.

## Launch-unblocking verification

The production browser SDK captured and redacted one controlled test exception; Sentry accepted its envelope with HTTP 200 at 12:41 UTC on 7 September. Event ID: `ff73623cc9a04236a4c7eb5a6c1db65e`. User/request/breadcrumb/extra/context data and the dynamic test message were absent. Owner project visibility and notification delivery remain unverified. `tools/release/verify-sentry-ingestion.mjs` reproduces this scoped check with a fresh public-page browser context.

The Production health manual workflow has `test_failure_notification`, default false. The existing account already has Actions email/on-GitHub notifications enabled, failed workflows only. [Drill 34127331845](https://github.com/DannyWolfofTech/Casher/actions/runs/34127331845) passed actual health checks and failed only the requested notification-test step; [normal follow-up 34128151586](https://github.com/DannyWolfofTech/Casher/actions/runs/34128151586) passed with the drill skipped. The configured delivery mailbox is not accessible in the current sessions, so email receipt remains unverified. Scheduled runs never enable the drill. Four provider jobs remain active; the recent health dispatch had no recorded error. Scheduled GitHub execution is still unverified.

At 15:15 UTC on 7 September, the public GitHub API showed the health workflow active on the public repository's default `main` branch, with two push and two manual runs but **zero scheduled runs**. Its configuration is present and manual execution works; scheduled detection remains unproven. Do not describe the schedule as a working alert service until a real scheduled execution and notification receipt have been observed.

Sentry's initial GitHub sign-in proceeded on the latest delegated request, but automatic approval review stopped the final OAuth grant of GitHub identity/email access pending specific owner permission. Review also stopped opening the private Gmail support mailbox. Neither action was retried through another route. Real ingestion evidence remains valid, but project visibility, alert configuration and notification delivery must not be inferred from it.

[Launch-unblocking instructions](launch-unblocking.md) contain exact Sentry/GitHub settings, the isolated-restore support request and SMTP2GO/Gmail values. SMTP2GO signup currently includes SMS verification; it must be completed personally with an authorized number. Google’s current documentation ends third-party Gmail Send as support in January 2027, so the requested setup is time-limited. No provider signup or legal agreement has been completed by the agent.
