# Casher Apple launch preparation — 11 September 2026

Casher is not ready for a public App Store launch. The owner requested the United Kingdom and European Union; the current release supports English and GBP CSV statements from one bank account. EU distribution does not imply EUR support. Checkout and bank connections remain disabled. No app upload, submission, purchase or agreement acceptance is authorized.

## Apple account and eligibility

Read-only App Store Connect inspection confirmed an active Free Apps Agreement, an individual account and no existing app records. EU trader compliance is unfinished. The Paid Apps Agreement is not active; no agreement was accepted here.

Apple guideline 5.1.1(ix) covers apps requiring sensitive user information as well as regulated fields. Casher stores identifiable bank-statement transactions; individual submission is an unresolved eligibility risk. Being a budgeting app does not establish an exemption. Obtain a written answer from Apple before committing to this enrollment route. An organization conversion requires a real legal entity and Apple's verification; a trading name alone does not establish one. [Review guidelines](https://developer.apple.com/app-store/review/guidelines/#data-collection-and-storage), [membership conversion](https://developer.apple.com/help/account/membership/updating-your-account-information).

Owner-authorized support question (sent 11 September 2026):

> I am enrolled as an individual and am preparing Casher, a personal budgeting app. Users import GBP CSV bank statements; identifiable transactions are stored in a private Supabase-backed account. The app does not connect to banks, move money, lend, trade or offer investment advice. Does guideline 5.1.1(ix) require organization enrollment for this specific data handling? If so, what is the supported conversion process before creating the App Store record? The iOS app is also a free companion to the web service, with no purchases or links to buy. Please clarify whether 3.1.3(f) applies to that model.

The owner authorized sending this question. Apple Developer Support accepted it through Membership and Account → Other Membership or Account Questions on 11 September 2026. App Review’s direct form required a numeric app ID that does not yet exist; the message asks Membership Support to route the policy questions internally. Submission was confirmed with a case ID, retained privately. No answer or Apple approval has been received.

## Owner decisions needed for UK and EU

The owner has only a home address and postcode and has not approved them for public disclosure. Keep both private. For an individual EU trader listing, Apple permits an address or P.O. Box; an alternate address requires evidence connecting it to the owner. A public phone number and email are also required. Organizations display the address associated with their D-U-N-S record. A paid provider must be chosen and purchased by the owner. Do not claim non-trader status to hide a commercial operator's details. Apple also requires payment-account details and a compliance declaration; the owner must complete those steps personally. [Apple trader requirements](https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-trader-requirements/).

A P.O. Box accepted in Apple's field does not by itself prove adequate legal notices for the service. The exact operator wording, an approved public service address, and any UK/EU privacy/consumer disclosures must be settled before launch. `docs/legal-owner-details.template.json` remains unapproved. No home address or personal phone is included in this document or public source.

## Implemented technical preparation

- Account has a distinct statement reset. It requires recent authentication, exact CLEAR confirmation and an idempotent request ID persisted before the request. It removes imported transactions, subscriptions, correction history, upload history and legacy spending history. Login, savings goals, billing identifiers, plan and monthly upload use remain.
- The database locks the same profile used by atomic imports. It blocks reset during account closure, limits excessive resets, denies anonymous access and retains private reset receipts. Lost-response retries return the original receipt instead of deleting newer imports. Deleted record IDs support exact reconciliation after restore; receipt responses expose counts only.
- Help and support is available at `/support` and linked from Account. It explains file limits, GBP-only support, retry behavior, recovery, data rights and the existing support mailbox.
- The Apple association source uses `WGUU2353D6.com.trycasher.app`, verified from the signed app and provisioning profile. Only `/auth` is associated. Published successfully on 11 September; the live endpoint returns HTTP 200, JSON and no redirect, and Apple’s CDN holds the identical file. Valid physical-device email-link acceptance remains separate.
- The iOS manifest describes account email/ID, financial information, purchase history, user content, customer support, operational product interaction and redacted diagnostics. No tracking, ads or session recording. The app's File Timestamp reason C617.1 covers app-cache export cleanup. This manifest is not a submitted App Store privacy label.
- `tools/mobile/inspect-signed-ios-release.py` verifies a signed device bundle, associated-domain/profile match, production configuration and privacy metadata. `--for-store` rejects development/ad-hoc signing.

## Review package draft

| Field | Prepared value |
|---|---|
| Name | Casher (availability not reserved) |
| Subtitle | Understand your GBP spending |
| Primary language | English (UK) |
| Category | Finance |
| Bundle ID | com.trycasher.app |
| Version / build | 1.0.0 / 1 (increment before uploading a replacement build) |
| Support URL | https://trycasher.com/support |
| Privacy URL | https://trycasher.com/privacy |
| Marketing URL | https://trycasher.com |
| Availability requested | United Kingdom and all 27 EU member countries |
| App price | Free; no native purchase flow |
| Keywords | budget,spending,statement,csv,subscriptions,expenses,personal finance |
| Release control | Manual release after owner-authorized submission and approval |

Description:

> Understand the spending in your GBP bank statements with Casher. Import a CSV to review money in and money out, explore spending categories and spot possible recurring payments. Check monthly history, correct transaction categories and track savings goals you update yourself.
>
> Casher works with the statements you choose to import. It does not connect to your bank, move money or cancel merchant subscriptions. Recurring-payment suggestions and renewal dates are estimates based on past transactions. Totals describe imported data, not your current bank balance.
>
> The Free plan includes one CSV upload each month. Supported files contain dates, descriptions and signed amounts or separate debit/credit columns, up to 5 MB and 10,000 rows. GBP statements from one bank account are supported; other currencies are not supported. Export saved account data on every plan. Clear imported statements while keeping your account, or permanently delete the account from Account settings.
>
> Sign in with email and password. Casher requires an internet connection to authenticate and save data. The mobile app has no purchase flow.

Review notes draft: describe the free companion model and exact available features; provide a dedicated reviewer login privately in App Store Connect with synthetic data and sufficient access for review. Keep that identity active throughout review. The disposable engineering account was removed after engineering tests and must never be submitted as reviewer credentials. Supply `docs/mobile-acceptance-statement.csv` and explain its expected totals. Point to Account for export, statement reset and complete account deletion. Explain that merchant cancellation opens an official provider page and does not cancel anything automatically. Do not advertise bank connections, EUR/multi-account support or AI processing.

## Privacy answers to reconcile in App Store Connect

Purpose is app functionality. Account email and user ID, statement financial information/purchase history, goal titles and other user content, support correspondence, and operational import/reset activity are linked to the user. Redacted crash/technical reports do not include an account ID or dynamic statement text. Tracking is false. There are no advertising identifiers, location permission, photo-library access, contacts access or session replay. Do not select “Data Not Collected.” Review the final Xcode privacy report and vendor practices against these source-based answers. Optional web Google profile fields are distinct from the native email-only sign-in flow. [Apple privacy definitions](https://developer.apple.com/app-store/app-privacy-details/).

Native encryption uses operating-system HTTPS, Web Crypto for authentication hashing and Keychain via KeychainSwift; no custom encryption implementation was found in the app's native code. Leave the export-compliance determination for the owner in App Store Connect and apply the Info.plist declaration only after the determination; no exemption is certified here. [Apple export compliance](https://developer.apple.com/help/app-store-connect/manage-app-information/overview-of-export-compliance).

## Remaining release gates

1. Apple eligibility/individual enrollment decision and owner-approved legal operator/public contact details; EU DSA verification.
2. Valid cold/warm confirmation/recovery on the signed physical iPhone. Live AASA and Apple CDN verification passed; that is not proof of a valid email-to-app round trip.
3. Final native Files import/export, account reset/deletion using disposable data, reboot/session lifecycle and manual VoiceOver/large-text acceptance. Record iPad behavior for the supported universal app.
4. App Store record, current age-rating questionnaire, privacy answers, accessibility declarations based on evidence, reviewer access and appropriate screenshots. The release must meet Apple's current SDK requirement: Xcode 26+/iOS 26+; this Mac has Xcode 26.6 and iOS SDK 26.5. [Current SDK rules](https://developer.apple.com/news/upcoming-requirements/).
5. Distribution archive/export and store validation, followed by separately authorized upload/submission. A development-signed app on the owner's iPhone is not an App Store distribution artifact.
6. Existing full-service recovery/cutover limitations in `docs/recovery-drill-20260907.md`, notification receipt evidence, and final operator disclosures. CSV-only release does not depend on enabling bank connections or checkout.

Keep source, backend deployment, installed device build and published website versions explicit in the handoff. Tests and local builds must not be described as approval or a public launch.

## Additional iPad findings

The 13-inch iPad Pro simulator exposed bare subscription and transaction currency tokens without useful spoken context. Native labels now combine payment details and identify transaction direction/merchant; History amounts include their month and flow. The subsequent signed Release XCTest passed overview accessibility checks (contrast, clipping and descriptions), History/rotation, Account/reset cancellation and Support. This is simulator evidence, not physical iPad or complete manual VoiceOver certification.

## Final iPhone simulator reset acceptance

The 6.9-inch iPhone Pro Max simulator passed the overview audit and screen/rotation review. Reset initially dismissed when an attempted tap outside the keyboard-constrained dialog reached the backdrop. The reset dialog now rejects outside dismissal; explicit Cancel/Close remain available while idle. With a normal upward swipe inside the dialog, password verification, CLEAR entry, submission and the empty dashboard passed in 14.4 seconds. The backend confirmed five transactions and one subscription/import removed, one savings goal and free-plan upload usage preserved, and exact deleted IDs retained privately for recovery reconciliation. A subsequent UI data export contained zero imported records and the retained goal.

These tests use an isolated disposable account on the real backend. They do not authorize changing the owner's financial records and are not evidence of physical-device destructive testing.

Native export presented the iOS share sheet successfully; local dismissal restored the export control. Exact DELETE confirmation then removed the disposable account, displayed the deletion confirmation and stayed signed out after process relaunch (19.9-second acceptance test). Database verification found zero identity, profile, transaction, subscription, goal, import, correction and reset-receipt rows. Temporary credentials were removed. The owner's physical iPhone session was untouched.

Five unedited, synthetic-data screenshot drafts are prepared locally under `release-artifacts/ios/app-store-draft-screenshots`: three 1320×2868 iPhone images and two 2064×2752 iPad images, all PNG without alpha channels. They were visually inspected and have not been uploaded. Refresh from the final distribution build before submission; a full marketing screenshot set and owner approval remain outstanding.

## Published and installed checkpoint

Application source `a1683e44dbbc16f2819d4c1bb8fceeab7324efbe` is published at `https://trycasher.com`; live response identifies deployment `4f86ff93-eece-475f-88f2-227b2292d829`. Both reset migrations are recorded in the production migration history. A clean signed Release app from the same source passed strict bundle inspection and was installed/launched on the physical iPhone 15 Pro. Its local ZIP is `release-artifacts/ios/Casher-Device-20260911-Launch.zip`, SHA-256 `e558d200e61b5c3e4652ff28ca690bb1e29330cfc8d612c18f73e1fd26560ed3`. Signing is Apple Development; no App Store distribution signing or validation is claimed. Documentation-only checkpoints may follow this application source.

## 11 September evening: physical email, Files and deletion acceptance

Apple Developer Support received the owner-authorized eligibility/companion-app questions. Its confirmed case reference and exact message are retained in the private physical-launch evidence. No reply or approval has been received.

Actual iPhone confirmation revealed a release defect: the Supabase verification redirect stayed in Chrome, leaving the user at web sign-in. The web callback now offers Open Casher with a registered reverse-domain app URL as a fallback. Verified HTTPS links remain supported; only one-use PKCE codes are accepted and redemption still requires the initiating app's device-secure verifier. Tokens, foreign hosts and malformed callbacks are rejected. Source `7394c0685f260b04ff1409a39254ab63d64a5c99` was published as deployment `e7880d0e-5bec-46db-b634-3940a3fad69e`. Subsequent local fixes constrain the native savings-goal date field and explain network/email-limit failures.

Physical acceptance used the owner's selected iCloud mailbox only after verifying it had no existing Casher account. The disposable account confirmed its email, completed a cold recovery return, changed its test password, selected an actual CSV from iCloud Drive, imported four synthetic transactions (£3,000 income, £19.99 spending, two separate equal-looking coffees, one detected subscription), created a savings goal, and saved its complete JSON export through iOS Save to Files. The saved export synced to the Mac and its records were independently verified. Original confirmation entered Junk despite SPF/DKIM/DMARC passing; the subsequent recovery email reached Inbox. Do not infer guaranteed inbox placement.

Exact-CLEAR reset completed on the physical iPhone after password verification. Backend verification confirmed four transactions, one subscription and one import removed; the goal, account and used upload allowance remained. Exact-DELETE then removed the disposable account. Signed-out relaunch passed and backend counts for the identity, profile, transactions, subscriptions, goals, imports, corrections and reset receipts were all zero. The owner's real Gmail account records were untouched; the phone was temporarily signed out of that account for testing and requires the owner's normal sign-in afterward.

The cold recovery's browser tap was interrupted by an XCTest/Chrome idle wait. A subsequent native read-only test verified Casher foreground with the password form enabled and the backend confirmed the test identity's session. Do not label the interrupted tap an automated success. One password-save request had a network error; a retry completed. Native keyboard focus and automation-startup failures were retained separately from successful product operations. The date-field width correction passed actual iPhone bounds checks and visual inspection.

A fresh signup after deletion was rejected with `email rate limit exceeded`; no replacement account was created. The precise deployed auth quota has not been inspected because the Lovable browser session is signed out and the connector exposes no auth-configuration method. Supabase documents configurable email limits for custom SMTP/Send Email hooks, while Lovable documents a separate workspace email limit; neither establishes this project's effective setting. Inspect both before release, preserve abuse controls and stay within the existing authorized plan. Do not silently change providers, enable automatic confirmation or raise paid usage. [Supabase rate limits](https://supabase.com/docs/guides/auth/rate-limits), [Lovable email limits](https://docs.lovable.dev/features/custom-emails).

Evidence: `.audit-results/physical-launch-20260911/RESULTS.md`. Validation includes 262 unit tests, the complete 56-case Chromium suite, focused Chromium/WebKit callback and failure tests, physical native scenarios and strict signed-bundle inspection. Remaining acceptance includes a successful fresh confirmation retest/warm callback after the email quota is resolved, device reboot/manual VoiceOver checks, distribution validation and the unchanged Apple/legal/full-service-recovery gates. This remains a development-signed app, not an App Store-ready submission.

Clean post-test device archive: `release-artifacts/ios/Casher-Device-20260911-Physical.zip`, SHA-256 `4358f8ec53903055696713f23ed8eb7a9ddf1e29a9caf89ad6add6b8a584d19f`. Strict signing/configuration/privacy inspection passed, and fixture passwords were checked absent from the bundle. Temporary plaintext test credentials/source were removed. Final focused callback/network/rate-limit checks passed four Chromium and four WebKit cases. Installation/deployment status is recorded in the private results and any later checkpoint.
