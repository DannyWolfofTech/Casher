# Mobile release status — 7 September 2026

The Android app is a signed release using bundled production assets, installed and tested on a dedicated Android 16 emulator. iOS now compiles as a Release simulator app on GitHub's standard macOS runner. Neither app has been submitted to a store. Simulator compilation does not establish signed-device acceptance.

## Implemented

- Capacitor 8.5.1, Android compile/target API 36, min API 24; iOS min 15.
- Production HTTPS API configuration, no preview server, no cleartext traffic, release WebView debugging off.
- Android Keystore / iOS Keychain session persistence, with a real write/read probe and failure closed. Native sessions do not use browser localStorage. Keychain uses device-only unlocked accessibility and no cloud synchronization.
- Native email/password authentication; secure PKCE confirmation/recovery link handling; strict HTTPS callback parser; logout, expired-link error and password-recovery UI. Google login remains hidden on native until its system-browser flow is validated.
- App foreground/background refresh, offline state, back navigation, dialog handling, safe areas and usable touch/input sizes.
- CSV file input, native cache export and OS sharing. Account data export is available to all plans. Cache exports expire after an hour on the next launch/export.
- Recent-authentication account deletion with exact confirmation and server-owned billing cancellation/deletion sequencing.
- Companion billing behavior: native purchase/Stripe links are hidden and guarded. No StoreKit/Play Billing implementation or store exception is claimed.
- Casher Android assets and iOS launch screen/icon source; iOS privacy manifest and associated-domain entitlement. Android backups and device transfer exclude app data.

## Reproducible Android build

Run `tools/mobile/build-android-release.ps1 -DeviceTests` with the installed JDK 21/Android SDK and dedicated emulator. It builds web assets, syncs Capacitor, assembles the signed release APK/AAB, runs release lint and connected tests, and copies the artifacts to:

- `release-artifacts/android/casher-1.0.0-release.apk` — installable Android release.
- `release-artifacts/android/casher-1.0.0-release.aab` — bundle for future owner-authorized Play testing.

Application ID: `com.trycasher.app`; version 1.0.0. The certificate SHA-256 is `84:12:1F:7D:5C:87:F1:C4:90:ED:3C:74:22:DA:EF:8F:E1:CB:63:4A:E9:D1:4F:D0:3B:52:B9:6B:C3:17:D4:B4`. Production serves its association at `https://trycasher.com/.well-known/assetlinks.json`.

The ignored signing key is `.audit-results/android-signing/casher-release.p12`; its password is protected by Windows DPAPI in `password.dpapi`, bound to this Windows account/machine. The owner must create a secure, recoverable backup of both the key and actual password before distributing an updateable app. Do not commit them, print them, or silently generate a replacement key.

Release instrumentation verifies actual native secure persistence and production configuration. The opt-in `tools/mobile/test-production-session.ps1` uses an explicitly provisioned disposable production identity supplied only to the test runner. It verifies production sign-in, saved records, recreation, JSON export through the OS share sheet, logout and recreation after logout. This is separate from browser tests using invented responses. The final acceptance report records any additional file-picker and deep-link results.

## Reproducible iOS build and remaining boundary

`.github/workflows/mobile-ios.yml` uses a standard macOS 26 runner for this public repository, without distribution credentials or a paid runner. It prepares only the intentionally public production configuration, runs `tools/mobile/build-ios-release.sh`, and packages `release-artifacts/ios/Casher-Simulator.zip`. The script converts the opaque Casher icon source to 1024px, syncs plugins, checks plists and builds the actual Release target. Preserve the ZIP when moving it from Windows to a Mac so framework symlinks survive extraction with `ditto`.

The [first hosted build](https://github.com/DannyWolfofTech/Casher/actions/runs/34116904087) succeeded at `fcfd5c1`. Independent inspection confirmed `com.trycasher.app`, iOS 15 minimum, arm64 and x86_64 simulator architectures, the production API, disabled cleartext/logging/remote-server settings, no tracking and no distribution signature. That initial artifact retained version `1.0`; source is now aligned to Android's `1.0.0`. The final acceptance report records the delivered artifact's exact source, version, hash and runtime test results.

`tools/mobile/test-ios-ui.sh` adds a real XCTest UI target on the build host and exercises native launch/navigation/privacy/relaunch and a recovery request to production Auth using a nonexistent reserved `.test` identity. It does not create an account or establish a valid email-link/session round trip. Failed checks remain failures; they are not replaced by mocked responses. `tools/mobile/inspect-ios-release.py` independently checks the packaged identity, version, simulator architectures, privacy/configuration and SHA-256.

The owner must provide an Apple Team ID and authorize the relevant signing/developer-account steps. Publish a valid apple-app-site-association using that Team ID; test cold/warm Universal Links, valid recovery, saved authenticated sessions, files, deletion, backgrounding and accessibility on an owner-controlled iOS device. An App Store/TestFlight build and review remain separate from this simulator build. No Apple/Google fee or legal agreement was accepted.

## Remaining release acceptance

Android needs broader physical-device/accessibility testing, real confirmation/recovery delivery through verified links, owner signing-key backup, Play Data Safety/reviewer metadata and an authorized distribution/store review path. iOS needs signed-device acceptance and distribution credentials. Native billing-policy compliance is designed around a free companion app but is not a store approval.

Sources: [Apple review guidelines](https://developer.apple.com/app-store/review/guidelines/), [Google payments policy](https://support.google.com/googleplay/android-developer/answer/9858738?hl=en), [Google consumption-only guidance](https://support.google.com/googleplay/android-developer/answer/10281818?hl=en), [Android target API requirements](https://developer.android.com/google/play/requirements/target-sdk).

The iOS manifest declares both financial information and purchase history because uploaded statements contain spending records, following [Apple's collected-data categories](https://developer.apple.com/documentation/bundleresources/app-privacy-configuration/nsprivacycollecteddatatypes/nsprivacycollecteddatatype). This is source metadata only; Xcode's final privacy report and store disclosures still need validation.


If Play App Signing later uses a different distribution certificate, add that verified certificate to assetlinks.json and retest association before release. The current association matches only the artifact delivered here.


Final device acceptance also selected the synthetic CSV through Android's actual system document picker, received production `REPLAY`, exported the same four records, and passed logout/recreation. Android reported `trycasher.com: verified` through its statement service without an override. The original production data counts were restored after deleting the disposable account. The remaining recovery gate is an actual email-to-app confirmation/recovery round trip, including cold and warm app states.

Recovery follow-up: production accepted a native password-reset request and the real email reached the disposable privacy alias's Inbox at 12:14 BST. Cold and warm invalid-link rejection/retry passed on the signed Android app. A valid email-link round trip remains unverified: automatic approval review blocked reading the private queue's credential-bearing email, and that test timed out without a callback. The test account was deleted afterward; do not reuse its credentials. See the acceptance report for the pending secure-link handling approval or manual-device alternative.
