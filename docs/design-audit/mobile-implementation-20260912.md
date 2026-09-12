# Casher mobile redesign implementation — 12 September 2026

Implemented the approved [Casher mobile Figma prototype](https://www.figma.com/design/HFA81FN7TV8hqVpSXXMmh1/Casher-Mobile-prototype-v1) in the existing React/Capacitor application. The original cream, navy and green tokens and the existing dark theme remain. No new package, paid logo API, backend migration or financial integration was introduced.

## Delivered behaviour

- Four persistent destinations: Overview, Activity, Subscriptions and Goals. Account and statement import are header actions. Activity preserves its search and direction filter when switching tabs.
- Overview shows spending, income, selected month, recorded dates, ranked category bars and estimated upcoming payments. Charts have a prominent entry point. Historical transaction endpoints never imply complete statement coverage.
- Activity uses date groups, explicit minus/plus amounts, bundled merchant artwork and category-icon fallbacks. Transaction details preserve the original statement description; editing remains a separate step. Existing pagination, paid CSV export and payment-direction corrections remain functional.
- Subscriptions presents estimated upcoming recurring payments, monthly/annual estimates and separate inactive records. Each row exposes its amount, cadence and expected date to assistive technology. Provider cancellation guidance is separate from confirming a change to a Casher record.
- Category charts show exact values and proportions. Monthly bars share a zero-based scale, support date filtering and selection, and disclose incomplete/unconfirmed coverage. Income minus spending is explicitly not a bank balance.
- Goals, account preferences, import history, export, statement reset and account deletion use the same controls and spacing. Exact CLEAR/DELETE, recent authentication/password checks, reset receipts, quota preservation and existing server enforcement remain intact.
- CSV files are parsed locally for review before the explicit Confirm import action sends them. The same shared parser validates both paths. The preview discloses unreadable rows, possible duplicate differences and file totals. Existing idempotent import, bounded uncertain-result handling and allowance reconciliation are retained.
- Empty accounts lead with the import/example actions, without empty zero-value statistics. They can open the clearly labelled Figma example without inserting records. Offline status identifies previously loaded figures and requires reconnection for updates.
- Sign-in, signup, reset-password, new-password and browser-to-app email return screens use the original wordmark, typography, surfaces and buttons. Native secure storage, PKCE and session-exchange protections are unchanged. Google sign-in remains web-only.

## Figma authentication extension

Added four editable screens to the same file before implementation: Sign in `62:652`, Create account `62:722`, Reset password `62:792`, New password `62:862`. Added a reusable Form field component `63:652` and connected the main navigation actions. The file now has 38 mobile screens/states plus reference boards; it remains a representative prototype rather than a backend simulation. Application error/success/authentication handling is real and separately tested.

Exported navigation SVG bytes are bundled under `src/assets/navigation`. The [merchant identity handoff](merchant-identities-20260912.md) describes the 32 local merchant assets, conservative matching and fallbacks. This does not promise universal recognition or assert third-party trademark endorsement.

## Verification

- Both TypeScript checks and production build passed. ESLint: zero errors, seven pre-existing React refresh warnings.
- 316 unit tests passed, including merchant matching, payment directions, CSV parsing, reset/import protections, native auth and honest statement coverage.
- 78 Chromium and 78 WebKit browser cases passed. The final first-use layout change also passed three affected cases in each engine. Browser acceptance covers populated/empty/error states, corrections, cancellation/dismissal, goal changes, synthetic CSV preview/import, reset/delete safeguards, cached navigation, native auth callbacks, stalled requests, 320/393/768/1440 layouts, large text and light/dark accessibility. Final run records are under `.audit-results/mobile-redesign-*-final.log`.
- WebKit findings fixed: its native month control ignored minimum height; button colour interpolation briefly lost contrast; the reduced-motion override introduced a tiny transition on otherwise static inherited colours. Explicit control height, immediate button colours and zero-duration reduced-motion transitions resolve these cases.
- Physical iPhone 15 Pro: sign-in, signup, reset screen, real keyboard and signed-out relaunch passed in 24.3 seconds. Native contrast, text-clipping and sufficient-description audits passed on sign-in and signup. Screenshots were visually inspected. No email was sent and no account was created or changed in this pass. The phone was already signed out, so the redesigned authenticated screens were tested with synthetic data in browsers, not with the owner's phone account.
- Signed iPhone SDK Release build and strict bundle/configuration/privacy/associated-domain inspection passed. The original XCTest source was restored. Device build uses the existing Apple Development identity, not App Store distribution signing.

The browser backend is synthetic and loopback-only. Its import/deletion tests do not prove fresh production backend acceptance. Earlier real backend/device evidence remains in `docs/MAC-HANDOFF.md`. This UI deployment does not resolve the separate legal, Apple eligibility, full-service recovery, notification, manual VoiceOver/reboot or distribution gates.

## Deployment

The owner explicitly authorized redeployment to the existing `trycasher.com` Lovable project. Source and deployment verification are recorded below after publication. No checkout/banking enablement, purchase, agreement, app submission or publication of private contact details is part of this change.

## Reviewed screenshots

- [First-use screen, synthetic account](assets/mobile-implementation/first-use.png)
- [Physical iPhone sign-in](assets/mobile-implementation/iphone-signin.png)
- [Overview, synthetic account](assets/mobile-implementation/overview.png)
- [Category charts, synthetic account](assets/mobile-implementation/categories.png)
- [Monthly charts, synthetic account](assets/mobile-implementation/monthly.png)

Final development archive: `release-artifacts/ios/Casher-MobileRedesign-20260912.zip`, SHA-256 `5a5af82d3fa7e3d0d5ab846dedfed07c40e3ff26670ab7530c2fe026f2247ecb`. All 32 merchant image bytes match the signed bundle. The final post-test build installed successfully. The preceding launch attempt at 03:27 BST was refused because the iPhone had locked; the preceding physical auth acceptance remains valid evidence for those tested screens, not a claim of a later unlocked launch.

## Published verification

Application source `3eaafb9f42534f54855e22597f77deb0b9a1b956` is saved on GitHub/main and published to [trycasher.com](https://trycasher.com). Lovable confirmed that exact synced source before publication; deployment request `0a656cb6-6646-4f18-b793-31825a761961`. The connector initially returned pending; subsequent independent live asset and browser checks establish the delivered revision.

Production now serves `/assets/index-B9QObV9M.js`. Its Auth, Dashboard and Account modules match the final local production build byte for byte, as do all 32 merchant images. A fresh signed-out mobile/desktop browser verified the redesigned login, signup and reset views, original palette, protected app routes and no JavaScript exceptions. The mobile sign-in was ready in 1,188 ms in this single headless run; this is not a general performance guarantee. No authentication form was submitted and no customer data changed. All four existing read-only production health checks passed.

The CLI lacked Git author identity and push authentication. The existing authenticated GitHub connector saved the staged files as immutable blobs/tree/commit, with each image SHA and the complete resulting tree checked against the local Git index before a non-forced main update. Local main was fast-forwarded while preserving the separate Android work. No credentials were extracted or Git identity settings changed.

Final acceptance: 316 unit tests, 78 Chromium + 78 WebKit browser cases, three affected first-use cases in each engine after the last layout refinement, both typechecks, zero lint errors/seven existing warnings, production build, signed iPhone inspection/installation, physical signed-out auth/keyboard acceptance and live publication verification. Final iPhone install completed at 03:32 BST. Unlock the phone and open Casher to sign in; authenticated physical redesign acceptance remains distinct from the completed synthetic browser cases.
