# Casher Apple launch preparation — 11 September 2026

Casher is not ready for a public App Store launch. The owner requested the United Kingdom and European Union; the current release supports English and GBP CSV statements from one bank account. EU distribution does not imply EUR support. Checkout and bank connections remain disabled. No app upload, submission, purchase or agreement acceptance is authorized.

## Apple account and eligibility

Read-only App Store Connect inspection confirmed an active Free Apps Agreement, an individual account and no existing app records. EU trader compliance is unfinished. The Paid Apps Agreement is not active; no agreement was accepted here.

Apple guideline 5.1.1(ix) covers apps requiring sensitive user information as well as regulated fields. Casher stores identifiable bank-statement transactions; individual submission is an unresolved eligibility risk. Being a budgeting app does not establish an exemption. Obtain a written answer from Apple before committing to this enrollment route. An organization conversion requires a real legal entity and Apple's verification; a trading name alone does not establish one. [Review guidelines](https://developer.apple.com/app-store/review/guidelines/#data-collection-and-storage), [membership conversion](https://developer.apple.com/help/account/membership/updating-your-account-information).

Unsent owner-support question:

> I am enrolled as an individual and am preparing Casher, a personal budgeting app. Users import GBP CSV bank statements; identifiable transactions are stored in a private Supabase-backed account. The app does not connect to banks, move money, lend, trade or offer investment advice. Does guideline 5.1.1(ix) require organization enrollment for this specific data handling? If so, what is the supported conversion process before creating the App Store record? The iOS app is also a free companion to the web service, with no purchases or links to buy. Please clarify whether 3.1.3(f) applies to that model.

This draft has not been sent. No claim of prior Apple approval belongs in review notes.

## Owner decisions needed for UK and EU

The owner has only a home address and postcode and has not approved them for public disclosure. Keep both private. For an individual EU trader listing, Apple permits an address or P.O. Box; an alternate address requires evidence connecting it to the owner. A public phone number and email are also required. Organizations display the address associated with their D-U-N-S record. A paid provider must be chosen and purchased by the owner. Do not claim non-trader status to hide a commercial operator's details. Apple also requires payment-account details and a compliance declaration; the owner must complete those steps personally. [Apple trader requirements](https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-trader-requirements/).

A P.O. Box accepted in Apple's field does not by itself prove adequate legal notices for the service. The exact operator wording, an approved public service address, and any UK/EU privacy/consumer disclosures must be settled before launch. `docs/legal-owner-details.template.json` remains unapproved. No home address or personal phone is included in this document or public source.

## Implemented technical preparation

- Account has a distinct statement reset. It requires recent authentication, exact CLEAR confirmation and an idempotent request ID persisted before the request. It removes imported transactions, subscriptions, correction history, upload history and legacy spending history. Login, savings goals, billing identifiers, plan and monthly upload use remain.
- The database locks the same profile used by atomic imports. It blocks reset during account closure, limits excessive resets, denies anonymous access and retains private reset receipts. Lost-response retries return the original receipt instead of deleting newer imports. Deleted record IDs support exact reconciliation after restore; receipt responses expose counts only.
- Help and support is available at `/support` and linked from Account. It explains file limits, GBP-only support, retry behavior, recovery, data rights and the existing support mailbox.
- The Apple association source uses `WGUU2353D6.com.trycasher.app`, verified from the signed app and provisioning profile. Only `/auth` is associated. Publication and actual device email-link acceptance must be verified independently.
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

Review notes draft: describe the free companion model and exact available features; provide a dedicated reviewer login privately in App Store Connect with synthetic data and sufficient access for review. Keep that identity active throughout review. The disposable engineering account used here is cleaned up and must never be submitted as reviewer credentials. Supply `docs/mobile-acceptance-statement.csv` and explain its expected totals. Point to Account for export, statement reset and complete account deletion. Explain that merchant cancellation opens an official provider page and does not cancel anything automatically. Do not advertise bank connections, EUR/multi-account support or AI processing.

## Privacy answers to reconcile in App Store Connect

Purpose is app functionality. Account email and user ID, statement financial information/purchase history, goal titles and other user content, support correspondence, and operational import/reset activity are linked to the user. Redacted crash/technical reports do not include an account ID or dynamic statement text. Tracking is false. There are no advertising identifiers, location permission, photo-library access, contacts access or session replay. Do not select “Data Not Collected.” Review the final Xcode privacy report and vendor practices against these source-based answers. Optional web Google profile fields are distinct from the native email-only sign-in flow. [Apple privacy definitions](https://developer.apple.com/app-store/app-privacy-details/).

Native encryption uses operating-system HTTPS, Web Crypto for authentication hashing and Keychain via KeychainSwift; no custom encryption implementation was found in the app's native code. Leave the export-compliance determination for the owner in App Store Connect and apply the Info.plist declaration only after the determination; no exemption is certified here. [Apple export compliance](https://developer.apple.com/help/app-store-connect/manage-app-information/overview-of-export-compliance).

## Remaining release gates

1. Apple eligibility/individual enrollment decision and owner-approved legal operator/public contact details; EU DSA verification.
2. Live AASA HTTP 200 with JSON content type and no redirect, Apple's association cache, and valid cold/warm confirmation/recovery on the signed physical iPhone. A local file or invalid-link test is insufficient.
3. Final native Files import/export, account reset/deletion using disposable data, reboot/session lifecycle and manual VoiceOver/large-text acceptance. Record iPad behavior for the supported universal app.
4. App Store record, current age-rating questionnaire, privacy answers, accessibility declarations based on evidence, reviewer access and appropriate screenshots. The release must meet Apple's current SDK requirement: Xcode 26+/iOS 26+; this Mac has Xcode 26.6 and iOS SDK 26.5. [Current SDK rules](https://developer.apple.com/news/upcoming-requirements/).
5. Distribution archive/export and store validation, followed by separately authorized upload/submission. A development-signed app on the owner's iPhone is not an App Store distribution artifact.
6. Existing full-service recovery/cutover limitations in `docs/recovery-drill-20260907.md`, notification receipt evidence, and final operator disclosures. CSV-only release does not depend on enabling bank connections or checkout.

Keep source, backend deployment, installed device build and published website versions explicit in the handoff. Tests and local builds must not be described as approval or a public launch.
