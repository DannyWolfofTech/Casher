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


## 11 September: iPhone dashboard fixes

Owner reported six defects: clipped overview month/year; pie-sector blue touch focus rectangle and overlapping tooltip; subscription review flow should lead with upcoming renewals/cancellation; redundant transaction Correct wording; same overlapping annual-cost donut; colliding blank native history month fields.

The Windows change replaces floating donut tooltips with selection in the center and keyboard-accessible legend buttons, expands the overview month control, stacks history month selectors on phones, shows expected renewals from the last imported charge, routes recognized Netflix/Spotify descriptors to verified official cancellation pages, and makes edits optional. No cancellation occurs just by opening the provider. Unknown merchants receive no guessed link. Existing unknown legacy payment directions remain disclosed, never silently rewritten. No database migration or billing/banking gate changes.

Validation: existing full check passed (237 unit tests, typecheck/build, zero lint errors with seven existing warnings), four new renewal/provider tests passed, all 34 Chromium browser tests passed, and the focused 393px touch WebKit test passed. These are desktop-run browser tests, not physical iPhone acceptance.

Original private financial screenshots are Windows-local under `.audit-results/iphone-ui-20260911/issue-1.png` through `issue-6.png`, with `iphone-reference-pictures.zip` containing all originals. They are deliberately excluded from Git. Remote messages were accepted but the Mac task still reports interrupted with no fresh execution; screenshot transfer and Mac/iPhone rebuild remain unverified. Resume from the latest main commit, run mobile sync/build, and test the six issues on the actual iPhone. Do not claim the images transferred without verifying receipt. Provider link sources: https://help.netflix.com/en/node/407 and https://support.spotify.com/us/article/cancel-premium/ (checked 11 September 2026).


## 11 September: extended Mac/iPhone defect hunt completed locally

The Mac checkout is now based on `d71e9d2e72e8c7d30504f886051d1b49f57f54e1` with the earlier Mac changes preserved and additional local fixes. Inspect and preserve the dirty working tree before any pull/reset. The original Windows private reference images were not transferred; new Mac/iPhone captures are separate and remain ignored.

The extended pass corrected keyboard-clipped fields, large-text and long-name overflow, destructive-state contrast, native chart/renewal descriptions, undersized disclosure/navigation/select targets, History table/tooltip overflow, nested upload controls, invalid display-preference crashes, unbounded data reads, export-dismissal errors and missing numeric goal progress. Native credential storage and financial/release restrictions remain intact.

Validation: 246 unit tests; 44 full browser regressions plus eight focused final regressions; 50 screen states across narrow/large-text/landscape/dark layouts; 16 physical iPhone scenarios plus two final native History/touch-target checks. Physical strict audits covered contrast, clipping and sufficient descriptions. Broad initial hit-region audit findings on static text are retained privately; this is not a claim of full manual VoiceOver or exhaustive accessibility certification. Tests exercised real authenticated read-only views and locally dismissed the OS export sheet, while mutating regression cases stayed on the existing loopback synthetic backend.

A clean signed Release build passed strict code-signature verification and was installed/launched on the iPhone 15 Pro (iOS 26.6.2). Simulator Release build/install/launch also passed. Private archive: `release-artifacts/ios/Casher-Device-20260911-Hunt.zip`, SHA-256 `2e6bf811cf03afa4a911aa4478faf8b96dac6508e1a2fe0f5b8ed820d23ee723`. Detailed findings and private screenshots: `.audit-results/hunt-20260911/RESULTS.md`. Original native test source and tracked reference images were restored after testing.

No production deployment, app submission, legal acceptance, purchase, banking enablement, provider cancellation, real import, account deletion or user-record correction occurred in this pass. Existing legal/provider/associated-domain/recovery launch gates remain separate. Source changes are local and uncommitted.

For simulator runtime testing, keep ad-hoc signing enabled (`CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=-`), as the existing simulator scripts do. An unsigned manual simulator build launched but failed the secure-storage probe; the ad-hoc signed build restored the normal signed-out screen. Do not weaken the vault or switch native sessions to web storage to accommodate an unsigned simulator.

## 11 September: real import, deletion and fresh-start acceptance

Continued the owner's request to upload a file and test starting over. Preserved their real account and financial records. Two internal disposable free accounts exercised the current local production build against real production authentication, CSV processing, export reads and account deletion. The build was served only inside an isolated automated browser; no production frontend or function deployment occurred.

A six-row CSV imported five transactions (£51.24 spending, £3,000 income), preserved two equal-looking purchases, detected one subscription and disclosed one invalid-date row. Malformed/unsupported-currency files did not consume an upload. Same-file replay did not duplicate records or quota usage; a different second file hit the free limit. UI exports contained the expected records. Account deletion removed the disposable identities and their dependent records. Recreating the same disposable email as a new identity produced a clean account that imported normally. Both accounts were removed afterward, all expected dependent tables were checked for zero remaining rows, and the temporary local credentials were deleted.

New local fixes bound stalled imports with an explicit unconfirmed-result/same-file retry, preserve a retry file after the last free upload, prevent closing an active upload panel, reconcile late import results safely, invalidate History caches after statement changes, bound Recent imports reads, reject malformed success responses, and preserve the successful account-deletion confirmation through sign-out.

Validation: 249 unit tests, typecheck/build, zero lint errors (seven existing warnings); 49 full Chromium browser cases plus one final malformed-response case; six focused WebKit cases; two physical iPhone Release checks for the upload panel, actual Files picker/cancellation, History and Account. Native contrast/clipping/description audits passed on the tested upload and History screens. The initial device attempt timed out enabling automation; it passed after the owner unlocked the phone. This does not claim a completed physical iPhone CSV import or deletion: those destructive flows used disposable accounts in the isolated browser. The real phone session remains intact.

Casher still has no statement-only reset retaining the login; the existing destructive flow deletes the whole account. No product reset feature or direct purge of owner data was added. Original native test source restored. Evidence is private under `.audit-results/import-reset-20260911/RESULTS.md`. Existing launch restrictions and outstanding legal/provider/recovery gates remain in force.

Final clean signed Release installed and launched on the physical iPhone: `release-artifacts/ios/Casher-Device-20260911-Import.zip`, SHA-256 `491e2741059c35203dd7f1f002cfe1062869bb02ea842ac763fca48fae348bda`. Strict code-signature verification passed after a clean post-XCTest build. Generated tracked browser screenshots were preserved privately and restored; source is still local/uncommitted.

## 11 September: statement reset and Apple release preparation

This entry supersedes the earlier statement that Casher has no statement-only reset. Source checkpoint `a1683e44dbbc16f2819d4c1bb8fceeab7324efbe` is saved on GitHub/main and deployed to `https://trycasher.com` as deployment `4f86ff93-eece-475f-88f2-227b2292d829`. All earlier accumulated web fixes are included. The local checkout was synchronized without discarding Android work. Android files and its separate setup report remain owned by the parallel Android task.

Account now offers authenticated, exact-CLEAR statement reset that keeps login, goals, plan and monthly upload use. Both reset migrations are deployed and recorded. Profile locking serializes reset with atomic imports, and durable request IDs prevent a lost-response replay from deleting newer imports. Private receipts retain exact deleted IDs for restore reconciliation. The operations runbook documents this requirement; it is not a new full-service restore success.

Other launch preparation: published Support page; updated privacy data/retention disclosures and iOS privacy manifest; verified Apple association file and matching live Apple CDN; native amount descriptions, language selection and keyboard-dialog dismissal fixes; signed-bundle inspection script; unsent Apple eligibility question, UK/EU metadata/privacy drafts and release gates in `docs/apple-launch-readiness-20260911.md`.

Fresh validation: 256 unit tests, typecheck/build, zero lint errors with seven existing warnings; 54 Chromium browser regressions and four focused WebKit reset/support cases; actual backend import/reset/reimport/replay with synthetic data; final production health checks. Native Release acceptance passed the physical iPhone reset-cancel/support audit, 13-inch iPad overview accessibility/History/rotation/Account/Support, and 6.9-inch iPhone review screens. The iPhone simulator then completed password verification, scroll/CLEAR reset, native export-sheet dismissal, exact-DELETE account deletion and signed-out relaunch. Database verification found zero remaining test identity, profile, transaction, subscription, goal, import, correction and reset-receipt rows. Temporary test credentials were removed and original native source restored. The owner's physical session/data were preserved.

A clean post-XCTest Apple Development-signed Release app passed strict signature, production configuration, privacy and associated-domain checks; it was installed/launched on the connected iPhone 15 Pro. Local ZIP `release-artifacts/ios/Casher-Device-20260911-Launch.zip`, SHA-256 `e558d200e61b5c3e4652ff28ca690bb1e29330cfc8d612c18f73e1fd26560ed3`. This is a development artifact, not App Store distribution signing. Five visually inspected, unedited synthetic-data screenshot drafts are in `release-artifacts/ios/app-store-draft-screenshots` (6.9-inch iPhone and 13-inch iPad sizes, PNG without alpha). Private detailed results: `.audit-results/apple-launch-20260911/RESULTS.md`.

Not production/App Store ready. Owner requested UK and EU and has only a home address/postcode, neither approved for public use. An individual EU trader listing may use a verified P.O. Box, but public phone/email and legal operator/service notices remain unresolved. Apple guideline 5.1.1(ix) makes individual enrollment eligibility for identifiable financial data an unresolved question; do not assert an exemption. The existing individual membership has an active Free Apps Agreement; Paid Apps Agreement is not active and no app record exists. Nothing was purchased, accepted, uploaded or submitted here; checkout and banking stay disabled.

Remaining acceptance includes valid cold/warm physical email links (AASA success alone is insufficient), physical Files import/export-to-Files with disposable data, reboot and manual VoiceOver/large-text checks, final distribution validation/store metadata/reviewer access and existing full-service recovery/notification gates. Do not replace these with simulator or mocked-test claims.
