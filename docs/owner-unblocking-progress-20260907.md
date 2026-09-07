# Owner unblocking verification — 7 September 2026

These are verified account and operations changes, not a new application deployment. Live checkout and bank connectivity remain disabled.

## Latest application follow-up

Frontend `9685c91e37646d2b52f6f3a4e5a3ca03a312fb2a` was published as deployment `994e3640-8522-430f-b881-43cde613064a`. The live Privacy asset now names Zoho Mail for outbound correspondence. Validation passed: 237 unit tests, 33 local browser tests, TypeScript, production build, lint with no errors (seven existing warnings), and 16 live desktop/mobile browser checks. Nine read-only production HTTP/authentication/webhook-boundary checks also passed. Both main and branch CI passed at this source. Android was rebuilt with the same release key; its current hashes and emulator installation are in the release report.

The owner reports removing their phone and address from Stripe invoices; the agent made no Stripe contact/identity changes. The owner confirms personal operation without a registered company or company number. No alternative public address is available or authorized, so the public-address launch gate remains unresolved. A geographic establishment address is part of the information described by [regulation 6](https://www.legislation.gov.uk/uksi/2002/2013/regulation/6); merely removing invoice fields or inventing a mailbox address is not a resolution. No home address was read or published.

Zoho supports creating application-specific credentials in its account security UI, but the attempted dedicated credential **Casher Privacy Gmail SMTP** was stopped by Zoho's required identity re-verification. No credential was created or copied. The owner verification tab is open; enter the existing Zoho password or complete its OTP route there, never in chat. After verification, SMTP eligibility and actual Gmail alias operation still need acceptance. Existing authenticated Zoho webmail sending remains available.

## TrueLayer

Owner signup, MFA and file handoff completed. Created Casher sandbox application `sandbox-casher-b3ef06`. The credential is verified and protected, including a DPAPI copy. Console shows Data Active, but the documented V3 `data` scope returns `invalid_scope` and the V3 connection endpoint returns 403. The owner-approved support request was sent, and support confirmed escalation with an email reply when an agent returns. Frontend/consent/sync acceptance is not complete. No production account, signing key for payments, commercial upgrade or production connection was configured.

## Recovery

The owner clicked Start export and placed its ZIP in the private local directory. The archive was extracted, restored and verified. See [actual recovery evidence and remaining service-recovery gaps](recovery-drill-20260907.md). Database/Auth/password integrity and permission/deletion checks passed; all temporary restored instances were removed. The provider-managed Vault secret did not decrypt on the replacement host. The browser downloads-page restriction was respected; the owner supplied the file directly.

The older `.audit-results/recovery-drill` directory denied filesystem access in this session. A fresh `.audit-results/recovery-current` directory and its imported files are restricted to the Windows owner and SYSTEM. Original owner files and private verification logs are retained there. The public repository contains no backup, credential or password fingerprint.

After explicit owner approval, the recovery follow-up was submitted through Lovable Support with Casher selected. The provider displayed **Your message has been sent successfully!**. The request asks for the existing-plan route to reprovision the undecryptable `email_queue_service_role_key`, recover Cloud configuration and object storage, and test a replacement without touching production. It explicitly forbids chargeable provisioning and an in-place restore. No backup, credential value or user record was attached. A support answer is still pending; no ticket reference was displayed.

## Latest release verification

Checkpoint `34d0c40079b0de3d8974db10cf3cd8bac224b178` passed [main CI](https://github.com/DannyWolfofTech/Casher/actions/runs/34158260759). Lovable's project API reports that exact latest commit with status completed, and the authenticated hosted preview renders the current CSV landing page successfully. The editor still labels the GitHub update Build unsuccessful; this is a provider UI discrepancy, not evidence of a newly broken production deployment. Direct anonymous preview requests require authorization. All four production health checks passed again after the support submission. No application source or deployed release changed in this follow-up.

## Monitoring

Sentry GitHub association completed following owner approval. Casher project `4511223530258512` is accessible. The generic redacted test issue is visible. Enabled alert `483773` has a recorded trigger at 13:42 BST on 7 September, and its existing high-priority conditions were preserved. Changed recipient from suggested assignees/recently active members to the explicit existing owner member; the saved detail view confirms that destination. A Send Test Notification call returned **Notification fired!**. This verifies provider dispatch, not receipt in the owner's mailbox.

GitHub scheduled production health execution is now observed: [run 34144223617](https://github.com/DannyWolfofTech/Casher/actions/runs/34144223617), created at 16:38:47 UTC on 7 September, completed successfully. This establishes one real scheduled run; schedule regularity and receipt of failure notifications remain separate checks. A fresh local public production-health check passed all four checks: database/anonymous-profile denial, Auth availability, website/assets, and anonymous billing rejection.

## Email

Owner completed Zoho signup. The agent configured the existing domain `trycasher.com` under Casher, verified ownership through TXT, and created `privacy@trycasher.com` in the EU region. Admin Console confirms **Mail Free**, five total licenses and one active user. No purchase, personal-contact publication or agreement acceptance by the agent occurred.

Published three public TXT records at GoDaddy: ownership `zoho-verification=zb08121082.zmverify.zoho.eu` at `@`, the single root SPF `v=spf1 include:zohomail.eu ~all`, and Zoho's generated public key at `zmail._domainkey`. Authoritative DNS confirms the values. Zoho confirms SPF and **DKIM Verified**, with DKIM status enabled. Existing Forward Email MX and encrypted forwarding configuration remain unchanged; incoming external mail still reaches the established forwarding destination, not Zoho's inbox. No personal mailbox migration was performed.

Outgoing display name is **Casher Privacy**. A synthetic owner-only test was sent from Zoho webmail at 21:34 BST on 7 September. Zoho displayed **Mail sent**, then **Email delivery status is Delivered**; the saved message header shows **Casher Privacy <privacy@trycasher.com>**. Recipient-side raw headers, SPF/DKIM/DMARC results, personal-address absence and reply round-trip remain unverified. The owner was asked to check the matching test message. Provider delivery status is not proof of inbox placement.

Gmail Send mail as is not configured. This provisioned free account shows an SMTP settings section, but no authenticated SMTP acceptance has been performed; POP/IMAP and forwarding are shown as unavailable/paid. Do not infer SMTP eligibility from a settings tab or purchase an upgrade. Next steps require private SMTP authentication and Gmail alias verification, followed by recipient-side header/reply acceptance. The existing inbound route remains operational throughout.

The owner confirmed receipt in Yahoo Spam. Inspection of that exact received test through Yahoo's raw-message UI verifies **SPF pass, DKIM pass (zmail / trycasher.com), and DMARC pass**. From is `Casher Privacy <privacy@trycasher.com>` and Return-Path is `privacy@trycasher.com`; the received message contains no personal Gmail address. Recipient transport used TLS 1.3. Yahoo's classification reason is not disclosed by these headers. The test was marked Not spam and Yahoo confirmed it moved to Inbox. This corrects the owner's mailbox classification only; it does not establish general inbox placement or the still-unconfigured Gmail SMTP route. Reply round-trip remains untested. No raw mailbox/session URL or private recipient header was saved to the repository.
