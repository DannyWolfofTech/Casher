# Casher: exact launch-unblocking steps

This is an execution checklist. It adds no product scope. Production checkout and banking stay disabled; no store submission, purchase or agreement acceptance is authorized. Do not paste credentials, verification links, signing passwords or personal contact details into chat.

**Latest owner-action checkpoint:** see [verified account/export/monitoring progress](owner-unblocking-progress-20260907.md) and [the completed database restore drill](recovery-drill-20260907.md). TrueLayer signup/MFA/credential handoff, Lovable export and actual database restoration, and Sentry account access are complete. A real GitHub scheduled health run passed. TrueLayer V3 access is denied by the provider; the owner-approved support request was sent and escalated. Full service recovery still needs provider-managed secret reprovisioning, storage/configuration recovery and cutover testing. The older instructions below are operational history, not requests to repeat completed approvals.

## 1. Stripe authorization

Authorization completed on 7 September through the existing signed-in account. The CLI verified the sandbox account and test price below without exposing/exporting an API key. The full real provider suite passed **30/30** at 14:04 UTC, and the resulting deleted-customer entitlement fix was deployed from `fbeee49`. The instructions remain for future reauthorization; this is no longer an owner blocker. Current acceptance evidence is recorded in the release report.

In PowerShell, from `D:\Projects\Coding\Casher`, run:

```powershell
./tools/release/authorize-stripe.ps1
```

The helper prints a fresh pairing code and the official `https://access.stripe.com/stripecli/oauth2/device` URL. Open that URL, enter the displayed code, and approve **Casher launch verification** for the existing **Casher sandbox**. Keep the terminal running until it confirms completion. If the code expires, rerun the helper; an expired code cannot be reused.

The CLI alone stores its credential under the restricted, Git-ignored `.audit-results/stripe-auth/` directory. The helper does not display or export a secret key. Expected sandbox account: `acct_1SCrpvJMS012Ip2A`; expected GBP monthly £9.99 test price: `price_1SYzJQJMS012Ip2AChBRKO5w`. These non-secret identifiers must be verified after authorization before any test mutation. No `--live` command is permitted.

The repeatable CLI route is below. Start isolated Supabase first and keep the first two services running in separate terminals. The bridge verifies the account/price, binds only to loopback, and uses a separate random local bearer credential. It protects its files before writing them. The ignored edge copy changes only the Stripe SDK HTTP transport so that the official CLI authenticates real provider calls. Never deploy that copy or its environment file. Original Stripe-signed CLI deliveries are forwarded unchanged for initial activation; signed genuine-event replays separately exercise ordering, duplicates and bounded retry. A deliberate delivery exclusion exercises missed-webhook reconciliation.

```powershell
node tools/billing-sandbox/serve-stripe-cli.mjs
node tools/billing-sandbox/prepare-cli-runtime.mjs
npx --yes supabase@2.116.0 functions serve --workdir .audit-results/stripe-workspace --env-file .audit-results/stripe-workspace/edge.env
node tools/billing-sandbox/verify-supabase.mjs --stripe --stripe-cli --interactive
```

Complete only the generated hosted **test** checkout and portal steps. The harness uses disposable sandbox customers and test clocks, then cleans up its own resources. It never requires a raw Stripe API key. Results are saved to `.audit-results/stripe-cli-acceptance.json`. This verifies real Stripe against local Auth/Postgres and actual edge business logic; it does not move test secrets into production or constitute a live charge. Live Pro stays disabled until acceptance passes and business disclosures are complete.

[Official Stripe CLI](https://github.com/stripe/stripe-cli) documents browser authorization; the installed CLI's device-flow output is used directly rather than a key-page export.

## 2. SMTP2GO and Gmail

Owner-only signup: open [SMTP2GO pricing](https://www.smtp2go.com/pricing/) and choose **Sign Up Free**. Use the following values; enter your actual owner identity personally where required.

| Field | Value |
|---|---|
| Plan | Free; no payment card or upgrade |
| Work email | `privacy@trycasher.com` |
| Product/trading brand | `Casher` (do not claim an unverified registered company) |
| Website | `https://trycasher.com` |
| Sender domain | `trycasher.com` |
| Intended sending | Human replies to Casher privacy/support inquiries; low volume, no marketing list |
| SMTP user label | `casher-privacy-gmail` |
| Public sender name | `Casher Privacy` |
| From and Reply-To | `privacy@trycasher.com` |

Create a unique password in your password manager, personally accept the provider terms and complete the activation email received through the existing privacy forwarding. The current signup form also includes SMS verification. If required, use only a business/other number you personally authorize supplying; no personal phone is to be entered by the agent. Stop if no acceptable number is available or payment is required. Free sending is currently advertised as up to 1,000 messages/month with no card. Provider account review may impose an initial sending restriction. [Pricing/signup](https://www.smtp2go.com/pricing/), [account review](https://support.smtp2go.com/hc/en-gb/articles/223087427-New-Account-Limits-and-the-Review-Process).

Once signup is complete, leave the signed-in session available. Next: **Sending → Verified Senders → Sender domains → Add sender domain**, enter `trycasher.com`, and select manual DNS setup. SMTP2GO generates three CNAME records for return-path/SPF, DKIM and tracking. Their exact hostnames/targets are account-specific and are not available before this step:

| Record | Host | Target |
|---|---|---|
| CNAME — return path/SPF | `[EXACT SMTP2GO RETURN-PATH HOST]` | `[EXACT SMTP2GO RETURN-PATH TARGET]` |
| CNAME — DKIM | `[EXACT SMTP2GO SELECTOR]._domainkey` | `[EXACT SMTP2GO DKIM TARGET]` |
| CNAME — tracking | `[EXACT SMTP2GO TRACKING HOST]` | `[EXACT SMTP2GO TRACKING TARGET]` |

These are clearly marked placeholders, **not DNS records to publish**. I will read the generated public records and add them at **GoDaddy → trycasher.com → DNS**, verify authoritative DNS and use SMTP2GO's **Verify** button until the domain says **Verified**. Existing Forward Email MX/routing and root SPF are preserved; the sender-domain setup does not require replacing them. Use GoDaddy's normal TTL initially. Disable open/click tracking for this human privacy mailbox where the provider supports it. [SMTP2GO sender-domain instructions](https://support.smtp2go.com/hc/en-gb/articles/115004408567-Verified-Senders).

Gmail: **Settings → See all settings → Accounts and Import → Send mail as → Add another email address**. Name `Casher Privacy`, address `privacy@trycasher.com`, treat as your own alias. SMTP server `mail.smtp2go.com`, port **587**, **TLS**, authentication required; use the dedicated SMTP2GO SMTP user's credentials, not the Gmail password. Verify the message from `send-as-noreply@google.com` received at privacy@. In the alias's **Edit info**, set Reply-To to privacy@; choose **Reply from the same address the message was sent to**. Select privacy@ in From when composing a new support message. This need not replace the default sender for unrelated personal correspondence. [SMTP2GO Gmail SMTP settings](https://www.smtp2go.com/blog/avoid-gmails-behalf-message-use-different-smtp-server/), [Google setup](https://support.google.com/mail/answer/22370?hl=en).

Acceptance: send a new message and a reply to an owner-controlled non-Gmail inbox. Verify displayed sender and raw From/Sender/Reply-To/Return-Path, SPF, DKIM and DMARC. Search headers privately for the personal Gmail address and record only pass/fail, never that address. Reply back and confirm receipt. Gmail vacation/automatic replies must not be assumed to preserve the alias. Google now states third-party Gmail Send as support ends **January 2027**; this requested setup has that remaining support window. A supported mail client using the same SMTP2GO sender will be needed afterward unless Google changes the policy. [Google's current limitation](https://support.google.com/mail/answer/22370?hl=en).

## 3. TrueLayer minimum owner action

Open [TrueLayer Console](https://console.truelayer.com/), sign up/sign in, personally accept its terms and verify the account email. Use privacy@ for the Casher contact where accepted. Provide truthful owner/business information personally. Select **sandbox**, not live onboarding, and leave the authenticated session available. Authorize configuration of a free **Data V3 recurring account-information** sandbox for a UK consumer budgeting app.

If app creation is part of signup: display name **Casher Sandbox**, sandbox client-ID suffix **cashersandbox** if available (Console prefixes it `sandbox-`; use the actual returned ID). Product is **Data**, requested scopes **accounts/transactions**, hosted recurring consent. No Payments merchant account or payment-initiation scope is needed. Preserve the client secret using the provider's secure download/password-manager route; do not paste it in chat. [Console quickstart](https://docs.truelayer.com/docs/quickstart-create-a-console-account).

If Data V3 is unavailable, ask TrueLayer: “Please enable a free Data V3 sandbox with hosted recurring consent and accounts/transactions access for Casher, a UK consumer budgeting app. We are not requesting production activation or payment initiation.” No production contract or regulated commitment is authorized.

Immediately afterward I will verify the enabled API against real calls, then implement/test connection and callback state, account/transaction persistence, deduplication, refresh/reconsent, revocation/deletion and failure handling. Callback registration will use the actual implemented sandbox endpoint; no invented or production-active callback is registered in advance. Production remains disabled pending the separate UK bank matrix, AIS/agent approval, KYB, contract, price and DPA/retention decisions in [provider selection](open-banking-provider-selection.md).

## 4. Android physical acceptance and signing backup

Install `D:\Projects\Coding\Casher\release-artifacts\android\casher-1.0.0-release.apk` on an owner-controlled Android phone. Version **1.0.0**, build **1**, package **com.trycasher.app**, SHA-256 **AC6FD80632E2FE972F6B7411F21E27A3EE45FEE8FAFD2BEB3E5E814E043B289B**. Transfer the APK by USB/file transfer and allow installation for that file manager only; disable that permission afterward. No Play submission is needed.

Use a disposable Casher account and the supplied synthetic fixture, never a real statement for initial acceptance. Record device model, Android version, pass/fail and non-sensitive screenshots. Do not record passwords or email-link URLs.

| Check | Required result |
|---|---|
| Install and first launch | Correct icon/splash; no debug banner, blank screen or secure-storage warning. |
| Sign up/confirm | Create the disposable identity; open its actual confirmation email on this phone; return to the correct app and sign in. |
| Session lifecycle | Sign in, background, reopen, remove from recents and relaunch, then reboot. Session persists securely until logout. |
| Recovery warm/cold | Request recovery in the app, open the actual email while running, change password; repeat after closing the app. Old password fails, new password works. Reusing an old link fails safely. |
| File import | Use the system picker for `docs/mobile-acceptance-statement.csv`: 4 records, £3,000 income, £19.99 spending, two separate £4.50 coffees. Check quota denial leaves those records unchanged. Re-import is checked where upload UI permits it; do not bypass the Free limit. |
| Export | Account export opens the OS share/save UI and contains only that account's saved records. |
| Network and navigation | Airplane-mode/reconnection messages, keyboard, Back, rotation, dark mode and large text remain usable; no lost dialog actions. |
| Links/permissions/billing | Android reports supported trycasher.com links; no unrelated permissions or native Stripe purchase links. |
| Delete | Sign in recently; Account → delete with exact confirmation. Account/session/data disappear; a different account remains untouched. Uninstalling alone must not be treated as deletion. |
| Logout | After logout/restart, previous records are inaccessible until a new sign-in. |

A verified local backup exists under `%LOCALAPPDATA%\Casher\SigningBackups\Signing-20260907-134146-7ba28ffc`. Both copied files matched their hashes and the private key reopened with the release certificate. This DPAPI copy requires the original Windows user/machine and does not protect against losing both.

For a portable backup, run the following locally with a real destination in owner-controlled NTFS storage, choose the prompted 20+ character backup password and store it in your password manager. The script re-encrypts the **same key** with AES-256, reopens it and verifies the existing certificate; it never prints a password. Then move the encrypted backup folder into your private off-device vault/storage. The portable interactive step has not been run because its recovery password must be yours.

```powershell
./tools/release/backup-android-signing.ps1 -Portable -DestinationDirectory 'C:\PATH-TO-YOUR-PRIVATE-BACKUP-STAGING'
```

Report acceptance results or attach the physical device for controlled testing; I will investigate failures and rebuild only where a defect is found.

## 5. iOS signing and device boundary

The current simulator build already passed three real UI tests. [Hosted build 34123424104](https://github.com/DannyWolfofTech/Casher/actions/runs/34123424104) passed the actual **iphoneos Release/arm64** target and all three simulator UI tests. Its downloaded `release-artifacts/ios/Casher-Device-Unsigned.zip` passed independent inspection; this unsigned ZIP is compilation evidence, not an installable/tested device app. The existing `.xcworkspace`, pinned Pods, version, privacy manifest, icon/splash and production config are prepared.

Provide **Apple Team ID** (normally 10 characters), whether an existing Apple Developer Program membership is available, and your signing route. Preferred: an owner-controlled Mac with Xcode signed into your Apple account and a USB-connected iPhone with Developer Mode enabled. Alternative: an already-owned development certificate/private key and provisioning profile transferred through private owner-controlled storage, plus the registered device UDID. No signing secret belongs in this public repository or chat.

For full link acceptance the profile must support **Associated Domains** for explicit App ID `com.trycasher.app`. Confirm program/capability eligibility in [Apple's capability matrix](https://developer.apple.com/help/account/reference/supported-capabilities-ios). A free Personal Team has limited seven-day provisioning and must not be assumed to cover the required capabilities or distribution. If membership is absent, you must personally decide/approve enrollment; no fee or agreement is accepted by the agent. [Apple account/program requirements](https://developer.apple.com/help/account/basics/about-your-developer-account).

On the signing Mac: open `ios/App/App.xcworkspace`; App target → Signing & Capabilities → your Team; keep bundle ID `com.trycasher.app`, the Associated Domains entry `applinks:trycasher.com`, and Release configuration. Have the owner complete any provisioning prompts. I will verify the signed app's actual `application-identifier` prefix against its profile before using it in the AASA; a legacy App ID prefix can differ from the Team ID.

`docs/apple-app-site-association.template.json` is an unpublished placeholder. After the real signed identifier is verified, I will serve the exact AASA at `https://trycasher.com/.well-known/apple-app-site-association` with HTTP 200, JSON content type and no redirect. Its only initial app route is `/auth`. Verify Apple's domain association and actual cold/warm email-to-app returns after installing the signed app. Do not publish the placeholder or remove entitlements to make signing appear successful. [Apple associated-domain guidance](https://developer.apple.com/documentation/xcode/supporting-associated-domains).

Signed-device acceptance then covers the Android checklist equivalents: real confirmation/recovery, secure session persistence/reboot/logout, Files import/share/export, account deletion, network/lifecycle transitions, rotation/keyboard and VoiceOver/large text. No TestFlight/App Store upload occurs until these pass and you explicitly authorize submission.

## 6. Monitoring and actual restore testing

**Sentry:** the production SDK's real error envelope was accepted with HTTP 200; its privacy filter passed. In your [Sentry account](https://sentry.io/), select Casher project ID **4511223530258512** and find event **ff73623cc9a04236a4c7eb5a6c1db65e** around 7 September 2026, 12:41 UTC. Confirm the event is visible with the generic redacted message. Leave the signed-in project available and identify the actively monitored owner alert destination. I will then verify the actual alert rule and a fresh test event's notification. Ingestion success alone is not proof of an alert.

**GitHub:** the signed-in account's Actions notifications were already enabled on GitHub and by email, with **Only notify for failed workflows** selected. The actual [notification drill 34127331845](https://github.com/DannyWolfofTech/Casher/actions/runs/34127331845) passed its real health checks and deliberately failed only the labelled drill step. The separate [normal run 34128151586](https://github.com/DannyWolfofTech/Casher/actions/runs/34128151586) passed and skipped the drill. The configured delivery mailbox is not available in the connected sessions; confirm receipt of the matching failure email there. No notification setting or email address was changed. The input defaults to false and scheduled runs never deliberately fail. [GitHub's settings instructions](https://docs.github.com/en/subscriptions-and-notifications/how-tos/managing-github-actions-notifications).

The independent health check passes, but scheduled GitHub execution has not yet been observed. Four provider maintenance cron jobs remain active; the recent health dispatch returned no recorded error. Notification and schedule evidence are still required.

**Lovable restore:** use [Casher's project](https://lovable.dev/projects/ea77ebbb-78bd-46c4-a0c9-0ab73994a416), **More → Cloud → Database → Backups** to inspect available snapshots. Do **not** click a production Restore button for this drill. Ask Lovable support through your account:

> For project ea77ebbb-78bd-46c4-a0c9-0ab73994a416 (Casher), provide an isolated restore/export route for an existing daily database backup, including schema and Auth data. The live database must remain untouched, restored cron jobs/outbound mail/billing must be disabled, and customer data must remain private. Confirm the steps and whether this is included in our existing plan before provisioning anything chargeable. Can the backup be restored into a separate private project or supplied through an authenticated export for an isolated local restore?

The initial support request was submitted through the owner's existing Lovable session. Lovable's AI support replied with the existing-plan **Cloud → Overview → Advanced settings → Export data** route, with one export/day and a 5 GB limit, and said isolated Cloud restores are unsupported. The [official export documentation](https://docs.lovable.dev/features/advanced-settings) confirms the limit and export exclusions. The initial 6.65 GB size blocker is now **resolved**: enforcing the deployed seven-day cron-history retention policy removed **1,611,280 expired operational log entries**, and history-only compaction reduced the database to **15,404,179 bytes**. Customer records remain **29 profiles, 490 transactions and 60 detected subscriptions**. Recent history is retained; no customer table was rewritten, no paid resize occurred and production was not restored.

**Owner action now needed:** approve the full Casher database export (including user/Auth and transaction records) into the existing Casher project's Lovable Cloud storage, with the provider's temporary download link emailed to the Lovable account owner. An explicit approval in the conversation is sufficient; the agent can operate the website. Automatic approval review stopped this exact transfer at **Start export**, so no export was created. The retained-backup screen was checked again and offers only **Restore to this backup**, with no download control. Do not click those in-place restore buttons for a drill.

After approval, exercise the actual export in the prepared network-isolated PostgreSQL target: verify export access restrictions, schema/migrations/counts/RLS/Auth and deletion receipts, ensure jobs cannot send mail/charge, test applicable data operations, measure elapsed restore time and clean up the isolated copy. The read-only production baseline covers 23 application tables, 34 migrations and deletion reconciliation; the container startup/isolation checks passed. These preparations are not a completed restore. A fresh logical export drill must be distinguished from restoring a retained daily snapshot, and exported passwords require a separately verified recovery path. No production data or Auth dump goes into public GitHub artifacts. Disaster recovery remains **not production ready** until an actual supported path has been exercised. [Lovable restore behavior](https://docs.lovable.dev/features/database).

## 7. Legal/public details

Fill the owner-required fields in `docs/legal-owner-details.template.json`: actual legal operator, authorized trading name, public business/service postal address, and company registration number if applicable. Confirm approval for public disclosure. Leave the phone field null. Do not supply a home address or personal phone. I will replace the clearly marked draft fields, update Terms/Privacy consistently, test and publish that specific disclosure change. No placeholder identity is currently presented as an approved operator.
