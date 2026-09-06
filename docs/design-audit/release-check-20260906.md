# Release checks — 6 September 2026

**The corrected application passes the tests below. The connected public site is not ready to accept customers yet.** Backend/frontend deployment, live billing configuration, historical-data acceptance and a working support/privacy inbox remain open. The fixes are in [PR #2](https://github.com/DannyWolfofTech/Casher/pull/2).

## Stripe identity and configuration

The Stripe account switcher explicitly identifies **Casher sandbox (SpendLeak)**. Its sandbox account is `acct_1SCrpvJMS012Ip2A`; the parent live account is `acct_1SCrpiJXnVWNQOUC`, named SpendLeak. The sandbox API's account endpoint independently returned Casher sandbox and the same ID. These are the sandbox and its parent, not two unrelated business accounts. This does not claim that every unrelated account visible in the account switcher was audited.

The existing Pro price, `price_1SYzJQJMS012Ip2AChBRKO5w`, belongs to that sandbox and is GBP 999 per month. The live account's product catalogue contains zero products. Hosted test checkout and portal still display the old SpendLeak sandbox business name; public-facing Stripe branding needs a Casher review before launch.

The sandbox endpoint `we_1SYzkiJMS012Ip2AOCaPTMhO` points to the connected Supabase project's `stripe-webhook`. At inspection it subscribed only to `checkout.session.completed`; its three deliveries for the week had all failed with HTTP 400 and `Invalid signature`. The repaired handler passes real-event signature and lifecycle tests in isolation, but the connected cloud endpoint still runs the previous code. Its actual signing secret must be installed and its delivery verified after deployment.

There was no sandbox billing-portal configuration. A default sandbox configuration was created with invoice history, payment-method updates and cancellation at period end. Plan switching remains disabled because Premium is unfinished. No live Stripe product, key, payment, customer or subscription was changed.

## Additional fixes implemented

- Checkout now receives a plan name and selects the price on the server. Live keys require explicit account and price configuration; sandbox defaults cannot silently become live settings. The server verifies the account and advertised GBP 9.99 monthly price before checkout. Signed webhook events from a different account or mode are rejected.
- Reconciliation cannot overwrite an established Stripe customer binding using event metadata. The previously deployed `create-checkout` URL now imports the same protected checkout implementation instead of leaving an obsolete endpoint behind.
- Fresh database startup failed because a historical migration revoked privileges on two email dispatchers that Lovable creates outside migrations. It now applies the same restrictions when those routines exist and can bootstrap without them. All migrations then applied successfully to a clean full Supabase instance.
- The actual edge runtime failed to boot through an esm.sh Supabase dependency URL. Supabase and Stripe imports now use pinned npm packages; the runtime, type checks and dependency lock are verified. The email service packages are pinned as well.
- Authentication emails contained the scaffold name `master-vault-download`. Sender/preview configuration now uses Casher and trycasher.com. The signed hook validates required fields, has correctly typed parsed payloads and avoids logging recipient addresses in routine console messages.
- CI now includes clean Supabase startup and real Auth/database/import/email tests, in addition to the existing app/browser checks. Private configuration and integration artifacts are ignored and stored separately from Playwright's temporary output.

## Test evidence

| Check | Result | Boundary |
|---|---|---|
| App types, lint, unit/PostgreSQL tests and build | Passed; 218 tests, zero lint errors, seven existing Fast Refresh warnings | Local release source |
| Browser regression | 22/22 passed | Real frontend; synthetic backend; four viewport sizes and key flows |
| App npm dependency audit | Zero known vulnerabilities | npm application tree; not a certification of every service dependency |
| Hosted Stripe sandbox flow | 19/19 passed | Actual Checkout with Stripe's test Visa and actual Portal cancellation; Deno handlers with an isolated Auth/PostgREST adapter |
| Stripe lifecycle after package-import repair | 18/18 passed | Actual sandbox API and Deno handlers; automated subscription creation instead of repeating the hosted UI |
| Full Supabase + Stripe integration | 19/19 passed | All migrations, real local Auth/PostgREST/PostgreSQL/edge runtime, real sandbox payments and events |
| All ten edge functions | Type checks passed | Frozen Deno dependencies, including email templates/dispatcher |
| GoDaddy/Lovable domain configuration | Both apex and www show Ready in Lovable | Publication is still required |

The [hosted-flow record](stripe-sandbox-hosted-20260906.json) and [full integration record](supabase-integration-20260906.json) contain the individual assertions. The hosted-flow record predates the npm import repair; the full integration record covers the repaired edge runtime. Test counts overlap and should not be added into a claimed count of unique requirements.

Stripe cases cover reusable checkout, unavailable plans, account ownership, signature rejection, duplicate delivery, successful renewal, failed renewal, recovery, period-end cancellation, stale-event replay and retry after a database outage. Real Stripe events were fetched through the API and signed with a **local test signing secret** for delivery to the isolated handler. This tests the actual verification implementation, but not Stripe-to-cloud network delivery or the cloud signing-secret setting.

The full local Supabase cases cover three independent logins, owner-only records, protected entitlement/quota fields, actual CSV imports, repeated purchases, overlap, malformed input, quota exhaustion, simultaneous imports, month rollover, correction ownership/stale edits, preserved manual subscription details, goals, all six email templates, signed email enqueue, privileged dispatcher denial, local recovery-email delivery, one-use recovery links and password replacement. A test-only Stripe subscription additionally exercises both deployed checkout URLs, paid-state persistence, portal, cancellation and stale-event replay against the real database.

Only new named test clocks/customers/subscriptions were mutated, and test clocks were deleted afterward. Local test users were deleted. SMTP went to the local mail catcher; no external inbox delivery or OAuth provider acceptance was claimed. Customer statement records in the connected cloud database were not modified.

## Domain changes and remaining launch gates

GoDaddy originally had no `www` record. Lovable supplied the exact A/TXT records; both were added and checked against GoDaddy's authoritative nameserver. Lovable now reports both `trycasher.com` and `www.trycasher.com` as **Ready**, with the notice that the domain will be live once the project is published. Existing apex, nameserver and email records were preserved.

The apex currently serves a hosting error saying its published files are missing. Publishing the reviewed build is required; a correct DNS record alone does not fix that page. Apex MX records are absent, so the advertised privacy inbox has not been verified. A destination inbox/email provider is still needed.

Before launch:

1. Apply the two new import/correction migrations and deploy **all changed functions**, including the legacy checkout alias and email fixes, to the connected environment. Reconcile representative sanitized bank exports and the legacy direction/correction records against originals. Existing lost transactions cannot be reconstructed from code alone.
2. Configure live Stripe account/Pro price/key and portal, and reconcile the four existing sandbox-linked customer profiles before using live keys. A sandbox customer ID cannot be reused in the live account. Set the real endpoint signing secret. Subscribe to `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`, `invoice.payment_succeeded` and `invoice.paid`. Confirm actual successful cloud deliveries and retries before collecting money.
3. Confirm the support/privacy inbox and real confirmation/recovery email delivery, OAuth redirects, backups/restore and deletion/support procedures. The isolated tests do not establish these operating arrangements.
4. Publish the reviewed frontend and verify apex/www HTTPS, deep links, login/import/billing behavior and production error reporting. Keep unfinished Premium/bank-connect capabilities unavailable. Complete the broader data/privacy/language acceptance in the original audit.

## Reproduce

Use Node 26, Deno 2, Docker and Supabase CLI 2.116.0. Run `npm run check` and `npm run test:browser` for the application. The CI workflow documents the clean full-Supabase sequence and supplies only an invented email-hook key.

For real Stripe sandbox acceptance, place the test-only secret in the ignored `.env.stripe-test.local`. The scripts refuse live keys and verify the exact Casher sandbox account before any mutations. Never put a secret in a `VITE_` variable or commit local service credentials.

```powershell
# Actual Deno billing handlers and Stripe lifecycle; add --interactive for hosted UI.
npx deno run --frozen --env-file=.env.stripe-test.local --allow-env --allow-net=api.stripe.com,127.0.0.1 --allow-read --allow-write=.audit-results/stripe-sandbox --import-map=tools/billing-sandbox/import-map.json tools/billing-sandbox/verify.ts

# After starting local Supabase and its functions (see CI), add sandbox integration:
# Edge runtime and this process need the same whsec_local_ test signing secret.
# Local edge env also needs LOVABLE_API_KEY=casher-local-email-fixture.
node --env-file=.env.stripe-test.local tools/billing-sandbox/verify-supabase.mjs --stripe
```

Reference behavior: [Stripe sandboxes](https://docs.stripe.com/sandboxes), [subscription testing](https://docs.stripe.com/billing/testing), [Supabase local development](https://supabase.com/docs/guides/local-development/cli/getting-started), [supported edge dependencies](https://supabase.com/docs/guides/functions/dependencies).
