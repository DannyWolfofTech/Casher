# Casher release continuation — 7 September 2026

This file supersedes the earlier uncommitted prototype notes. The production backend has been deployed, maintenance jobs enabled, inbound privacy-mail delivery verified, and the web release published. Use [release acceptance](release-acceptance-20260907.md), [operations runbook](operations-runbook.md), [mobile status](mobile-readiness.md) and [provider comparison](open-banking-provider-selection.md) for the current evidence and blockers.

Do not reintroduce the retired Open Banking V1 mock, fake admin revenue/referrals, unconfigured welcome-mail sender, Premium marketing or paid checkout before their documented gates pass. Retired code is retained only as text under `experiments/` and is excluded from production builds and migrations.

Free inbound forwarding uses encrypted DNS routing to the owner's existing Gmail. Actual external mail and an actual production operational alert both arrived, initially in Spam. Sending/replying as privacy@ is still unconfigured. Do not publish or copy the personal forwarding destination into documentation.

TrueLayer Data V3 is selected. No real sandbox account/credentials or complete bank integration is claimed. The owner must personally finish the provider account/terms step before the real sandbox work can proceed; production additionally needs written regulatory/commercial approval.

Current Stripe changes are deployed with sales disabled. The fresh real-Stripe lifecycle suite is prepared but awaits official CLI sandbox authorization. No real charge or Stripe identity/contact change was made.

Android is a signed production release with actual emulator acceptance. iOS now compiles in Release on GitHub's standard macOS runner for this public repository; a simulator ZIP has been downloaded and inspected. Device signing, Team ID/Universal Links and signed-device/store acceptance remain outstanding. See the acceptance report for exact artifacts, hashes and runtime test results.

Independent read-only production checks are deployed in GitHub Actions, covering the site/assets, Auth, database/RLS and unauthenticated billing denial. The first hosted run passed. The schedule is configured for every 15 minutes; notification delivery to an actively monitored owner destination, Sentry access and an isolated backup restore drill remain unverified.
