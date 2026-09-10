# Casher continuation on Mac — 10 September 2026

This is a curated continuation record, not an imported chat transcript. The original work ran in `D:\Projects\Coding\Casher` on Windows. The owner now has a MacBook Air M2 and iPhone 15 Pro. Their arrival does not establish iOS signing or physical-device acceptance. Apple Developer membership and Team ID are still unconfirmed.

## Start here

Use the actual local clone of `https://github.com/DannyWolfofTech/Casher.git`. Inspect its working tree before changing anything. Pull or clone the current main branch without overwriting local work. The last application source was `9685c91`; documentation checkpoint `d203a47` records the completed email work. This handoff is a later documentation-only checkpoint.

Read these files before resuming:

- `docs/release-acceptance-20260907.md` — subsystem acceptance and test evidence.
- `docs/owner-unblocking-progress-20260907.md` — latest provider/account operations; later entries supersede historical blockers.
- `docs/launch-unblocking.md` and `docs/mobile-readiness.md` — device checklist, signing and builds.
- `docs/recovery-drill-20260907.md` and `docs/operations-runbook.md` — recovery limits and production operations.

## Owner instructions that remain in force

Finish launch blockers only. No new product scope, elegance refactors, extra mocks or claims of completion based only on local/debug builds. Work autonomously through authorized reversible steps. Do not spend money, accept legal agreements, submit apps to stores, make real financial transactions, or publish the owner's home address/personal phone. Do not change Stripe identity/public-contact settings. The owner personally operates Casher and has no company number; an authorized non-home public address and exact approved legal operator wording remain unresolved.

Keep Pro checkout disabled until all applicable launch gates pass. The real Stripe sandbox suite already passed 30/30; do not repeat signup or request raw secret keys. Final live delivery/configuration and legal gates are separate. Keep production banking disabled until actual provider integration and production onboarding are complete. Do not weaken security to pass tests.

## Verified state as of 7 September

- Web frontend `9685c91e37646d2b52f6f3a4e5a3ca03a312fb2a` deployed to `https://trycasher.com`; deployment `994e3640-8522-430f-b881-43cde613064a`. Billing functions deployed from `fbeee491d983d86ec7153faab31be2ad271f2afe`.
- 237 unit tests, 33 local browser tests, typecheck/build and 16 live desktop/mobile checks passed. Lint had zero errors and seven existing warnings. These are dated results, not fresh Mac acceptance.
- Email is resolved: free Zoho EU SMTP plus existing Forward Email inbound route. Both configured Gmail accounts can send as `Casher Privacy <privacy@trycasher.com>`. The receiving account replies automatically from the original recipient address. Real sending, inbound replies and direct Gmail replies passed recipient SPF/DKIM/DMARC with no personal Gmail address exposed. New messages require selecting privacy in From. Initial Spam delivery means general inbox placement is not guaranteed. Do not regenerate credentials or replace MX unnecessarily.
- TrueLayer Data V3 selected. Owner completed signup/MFA; sandbox client `sandbox-casher-b3ef06` has valid credentials but required V3 `data` scope returns `invalid_scope` and connection creation returns 403. Owner-approved support request was sent and escalated. Real V3 frontend/consent/sync acceptance is not complete. Await provider entitlement resolution; no paid/production commitments.
- Actual isolated database restore passed integrity, Auth/password, RLS/permission and deletion checks. Full disaster recovery is not ready: replacement-host Vault decryption, storage/configuration and service cutover remain unresolved. Owner-approved Lovable support follow-up was sent. Check for its supported existing-plan recovery route; never restore in place on production.
- Sentry test event and alert dispatch passed; GitHub failure drill and scheduled health execution were observed. Notification receipt and full service recovery remain separate gates.

## Mobile and safe Mac continuation

The latest Android APK is Windows-local `release-artifacts/android/casher-1.0.0-release.apk`, SHA-256 `24E8A7A8061C3E31154740E9D693200357596EA50013791BD5A6F00A04301CAC`. It is signed and emulator-installed; physical-device acceptance is still required. Preserve its original signing key. The signing password and provider credentials protected with Windows DPAPI cannot simply be decrypted on a Mac. Do not replace the key or put credentials/backups into Git.

iOS run `34161059742` at `9685c91` passed simulator and iPhone SDK Release builds plus all three UI tests. Downloaded ZIPs were independently inspected; current hashes are in `docs/mobile-readiness.md`. The device ZIP is unsigned and not installable. Build artifacts, private database exports, ignored environment files and Windows credential stores do not come with a normal Git clone.

On the Mac, inspect installed tools, repository scripts, `ios`, `tools/mobile` and CI workflows. Prepare Xcode and the simulator, keeping owner-required license acceptance/sign-in separate. Run appropriate checks and compile before asking for signing approval. Determine the owner's available signing route, Team ID, device trust/developer mode and provisioning requirements. Test real cold/warm recovery links, authenticated sessions, file import, deletion and lifecycle on the iPhone. Do not claim store readiness before signing/device/policy gates pass.

Computer Use must be enabled in the Mac app itself with its supported plugin and macOS Screen Recording/Accessibility approvals. Windows tool availability and browser sessions do not transfer by signing into the same ChatGPT account. Inspect the Mac's actual capabilities before claiming control. Preserve the Windows conversation and private files; this handoff intentionally contains no raw transcript, secret keys or customer records.
