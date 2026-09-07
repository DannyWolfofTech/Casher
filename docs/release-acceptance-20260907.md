# Casher release acceptance — 7 September 2026

**The hardened CSV web core is deployed. The full requested launch is not yet production ready.** This report distinguishes shipped behavior from unverified integrations and owner-only boundaries. No purchase, real charge, store submission, Stripe identity/contact change or legal agreement acceptance occurred during this release work.

## Deployed version and checkpoints

Production: https://trycasher.com (alias https://trycasher-com.lovable.app).

- Current frontend source: `983d59f447ab2472a10e8ea583e32361ff5c2af7`; deployment `69cb4c89-d9b2-4008-b9ee-b735eb512992`. Live route/layout/navigation checks passed after publication.
- Backend implementation source: `cd40d1d1de2a4e3369ea0300932e7b8679f84807`; platform deployment confirmation checkpoint `c7a24c96d44f931f78dce54f488b97bdff2ac858` records 12 deployed edge functions. The later frontend checkpoint changes no backend behavior.
- Major hardening checkpoint: `6a9cca51091362fc8353beb3d3014792c1056e7f`; actual-provider unsubscribe/retention fixes: `cd40d1d`; navigation/live acceptance checkpoint: `983d59f`.
- [Hosted Linux CI](https://github.com/DannyWolfofTech/Casher/actions/runs/34113836041): both `check` and `supabase-local` succeeded at `983d59f`.
- Eight new production migrations from `20260907100000` through `20260907130000` were applied and recorded. Four maintenance jobs are active. See the [runbook](operations-runbook.md).

## Acceptance by subsystem

| Subsystem | Status | Completed and verified | Exact blocker / type | Exact owner action |
|---|---|---|---|---|
| CSV web app and hosting | PRODUCTION READY | Deployed imports, duplicate/replay handling, direction/category correction, history, goals, responsive public/account UI; real production import/export and ownership checks. Local-only/mock bank and fake admin paths removed. | None for the documented GBP, single-bank-account CSV scope. Overall public launch still depends on legal/support rows. | None for deployment. Supply original statements when repairing ambiguous older data. |
| Authentication, authorization and account data | PRODUCTION READY | Server-verified identity/recent sign-in, protected entitlements, RLS/service-only operations, persistent limits, strict origins, bounded requests, deletion sequencing and full saved-data export. Real local Auth recovery and production isolation verified. | Native recovery acceptance is tracked separately; paid-account deletion still needs fresh Stripe acceptance. | None for the verified Free web-account scope. |
| privacy@ inbound mail | PRODUCTION READY | Free encrypted forwarding DNS; external message and actual production maintenance alert both arrived. | Both initially landed in Spam; inbox placement is not guaranteed. | Check Inbox and Spam until sender reputation/rules are established. |
| privacy@ sending and replies | NOT PRODUCTION READY | Free/already-paid options researched; no personal mailbox disclosed in DNS or public documents. | SMTP provider account/credentials and domain send-as configuration absent. Type: credential / provider legal signup; optional paid alternative. | Personally create/verify SMTP2GO Free and accept its terms, then authorize domain/SMTP and Gmail send-as setup. Do not paste credentials in chat. Forward Email paid SMTP is optional only after spending approval. |
| Stripe billing | NOT PRODUCTION READY | Server-selected price/account/mode, signed webhooks, fenced reconciliation, entitlement binding, account deletion/cancellation safeguards, scheduled repair and alerts deployed. Invalid signatures/unauthorized calls rejected. | Fresh real-Stripe checkout → webhook → activation → renewal/failure/recovery → cancellation/portal → reconciliation suite is prepared but unexecuted. Type: credential / explicit provider authorization. | Authorize the official Stripe CLI for the Casher sandbox. Complete business disclosures. After safe provider tests pass, authorize enabling live sales; no real charge is required for the prepared suite. |
| Open Banking | NOT PRODUCTION READY | Current TrueLayer/Plaid/Yapily/Enable Banking comparison completed; TrueLayer Data V3 selected; stale V1 mock retired and all live connectivity disabled. | No provider account/credentials/Data V3 enablement. Real sandbox/frontend/consent/sync/revocation integration is not complete. Type: credential + technical; production regulatory/KYB/contract/commercial gates. | Personally sign in/create TrueLayer Console, accept its terms, authorize free Data V3 sandbox setup. Request UK consumer budgeting AIS/agent coverage, bank matrix, quote and DPA; personally complete/accept required production onboarding. |
| Android installable release | NOT PRODUCTION READY | Signed APK/AAB with bundled production assets, API 36, secure native storage, production session/restart/logout and OS export/share acceptance; no native Stripe upsell, backups or cleartext. | Broader physical-device/recovery/accessibility acceptance and store metadata/review remain. Type: technical / hardware / credential / store review. | Securely back up signing key and password; provide an Android device for physical acceptance. Decide/authorize a Play testing account and any fees separately. No submission occurs without approval. |
| iOS | NOT PRODUCTION READY | Native project, secure-storage integration, lifecycle/auth/file/deletion code, privacy manifest, brand icon source/launch screen, build script and associated-domain entitlement prepared. | No Mac/Xcode/CocoaPods build, Team ID, signed device artifact or runtime acceptance. Type: hardware / credential / store review; possible paid developer account. | Provide Mac/Xcode access and Apple Team ID. Personally approve enrollment/signing agreements/fees when needed. Run simulator and signed-device acceptance before TestFlight/store review. |
| Production hardening | PRODUCTION READY | Auth/RLS/ownership, secret placement, strict CORS, webhook verification, import/billing limits, bounded bodies/timeouts, error redaction and operational retention deployed and tested; dependency audit clean. | This is a scoped engineering verification, not a security certification. Historic data quality and recovery/monitoring rows still apply. | None for the shipped controls. |
| Monitoring and recovery | NOT PRODUCTION READY | Daily backups visible, retention and deletion receipts, four cron jobs, actual delivered operational alert; rollback/recovery runbook written. | No isolated backup restore drill; Sentry owner access and independent outage alerting unverified. Type: technical / provider access; paid environment only if provider requires it. | Provide access to the existing Sentry project and request an isolated restore/export route from Lovable support. Approve any charge only if a free/existing environment is unavailable. Restore acceptance and independent monitoring must then be completed. |
| Legal/product disclosures | PRODUCTION READY BUT REQUIRES MY FINAL EXTERNAL ACTION | Privacy/Terms/bank-data/deletion/CSV/subscription copy brought into line with shipped behavior; absolute-security/Premium/native availability claims removed. | Legal operator/trading name and public service postal address are missing. Type: legal / owner identity disclosure. | Supply the legal trading/operator name and a public business/service address you authorize publishing; personally approve the resulting Terms/Privacy disclosures. Do not supply a home address or personal phone. |

## Test evidence

- `npm run check`: TypeScript passed; lint zero errors (7 existing Fast Refresh warnings); **237 tests across 29 files passed**; production build passed.
- Browser regression: **33 passed**, including seven About languages and navigation reset. Hosted Linux checks pass after correcting the French/Polish 320px overflow.
- Fresh local Supabase: every migration applied; **18 real Auth/PostgreSQL/edge integration groups passed**, including owner isolation, atomic imports/limits, real recovery mail, password replacement, deletion, service authorization and unsubscribe suppression.
- Frozen Deno checks passed for the changed backend and email functions in hosted CI.
- `npm audit --audit-level=high`: **0 vulnerabilities** in the resolved tree.
- Actual production readonly API/security checks: **9 passed**.
- Actual production public browser checks: **16 passed**, 320/390/1440 widths, six routes, navigation and Android association. No backend fixtures in these tests.
- Actual production disposable-account checks: **5 groups passed** for sign-in/RLS, paused checkout/origin/service boundaries, real import/exact amounts/repeated purchases/replay/quota, full export reads and entitlement/ownership-injection denial. Production account deletion also passed and invalidated its session.
- Android signed release build, lint and signature verification passed. Two native configuration/Keystore instrumentation tests passed; a separate opt-in production sign-in/recreation/system CSV selection and replay/export/share/logout test passed. Its default skip is not counted as a pass.
- Fresh real Stripe lifecycle, TrueLayer sandbox acceptance, iOS compilation and backup restore drill: **not run**; not represented as passing mocks.

## Android artifacts

`release-artifacts/android/casher-1.0.0-release.apk`
SHA-256: `E6CB1DE1D3B48168DAEB2406A5E4BA627F445FE7AACBEF0DD371696C592C5274`

`release-artifacts/android/casher-1.0.0-release.aab`
SHA-256: `2B388199361A197472DA1B9688E5E391D179E90B81482960477A4C9548EC51A2`

Both use application ID `com.trycasher.app`, version 1.0.0, and source `983d59f`. The APK uses verified v2 signing with the RSA-3072 Casher release certificate. Artifacts and signing material are intentionally ignored by Git. [Mobile build/owner instructions](mobile-readiness.md) give exact paths and recovery requirements. **No iOS artifact was produced.**

## Remaining known risks and intentionally disabled behavior

- 481 historical transactions lacked reliable direction in the pre-release inspection. Missing original information and duplicates discarded by old code cannot be reconstructed honestly; warnings and manual correction remain. No automatic guessed backfill.
- CSV supports GBP and one bank account; identical purchases across different accounts cannot be distinguished reliably. Possible-subscription detection can miss or misclassify charges; cancellation happens with the service provider.
- New Pro sales are paused in frontend and backend. Premium purchase/marketing is removed. Existing billing management remains available, but fresh provider lifecycle acceptance is still required.
- All production bank connectivity, bank endpoints/migrations, bank token storage, bank sync and bank connection UI are disabled/absent. TrueLayer production onboarding has not started.
- Native Google sign-in and native digital-subscription sales remain disabled. No store publication or iOS build is claimed.
- Backups are daily, approximately 14-day retention; up to one day's database loss is possible. Storage files are not included; no PITR or tested restore RTO is claimed. Same-provider jobs cannot independently detect their own provider's outage.
- Operational mail has reached Spam. Normal Gmail replies still expose the Gmail sender until SMTP send-as is configured.
- Main JS bundle exceeds 500kB minified; seven lint warnings and Gradle 9 deprecation warnings remain, with current builds/tests passing.
- Retired welcome-email endpoint returns 410; old unconfigured sender, fake referral/admin metrics and old in-memory/mock billing/bank harnesses are archived outside the production path.
- Existing local marketing video/assets were reviewed and preserved under `docs/marketing`; illustrative figures are disclosed. They were not published.

## Approval-review boundaries

Automatic approval review rejected exporting the Stripe API-key page because it could disclose secret credentials into the transcript. The safer official sandbox CLI authorization remains pending. It also rejected submitting the TrueLayer signup form because it would initiate an external account/onboarding flow without specific signup authorization. Neither rejected action was bypassed. The owner actions above are required before those dependent provider steps continue.

## Final cleanup and native evidence

The disposable production account was deleted through the deployed `delete-account` endpoint at `2026-09-07T11:06:16Z`; its session was rejected afterward. Independent aggregate SQL confirmed zero remaining test Auth/profile/transaction/upload rows and restored the original **29 profiles, 490 transactions and 60 detected subscriptions**. Four maintenance jobs remained active. No existing customer records were exported or altered.

The native file test used a controlled fixture-only quota reset to expose the Free upload UI and reselected the already-imported four-row CSV through Android's actual document picker. Production correctly returned `REPLAY`; the JSON export still contained exactly four transactions. This complements the earlier genuine first-import/quota API checks; it does not claim a second billable upload or real banking data.

Android's `pm get-app-links com.trycasher.app` reported **trycasher.com: verified** after asynchronous verification, using the delivered release certificate. No domain state was manually approved or overridden. Real emailed recovery/confirmation round trips and broader physical-device acceptance remain outstanding.

Final device test: **1 passed** (full production session/file/export/logout flow), in addition to the **2 passed** native storage/configuration checks. The delivered APK remains installed on the dedicated `CasherRelease` Android 16 emulator. The disposable credential file was removed after account cleanup; no credentials were included in the app, repository or release report.
