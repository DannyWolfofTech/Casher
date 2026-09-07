# Owner unblocking verification — 7 September 2026

These are verified account and operations changes, not a new application deployment. Live checkout and bank connectivity remain disabled.

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

`privacy@trycasher.com` already receives through forwarding; it is not yet a verified outbound mailbox. On Zoho's free business signup, the contact Email address is the owner's existing reachable account. The custom-domain mailbox is configured later with domain `trycasher.com` and mailbox name `privacy`. Signup, any required personal verification and terms must be completed by the owner. Do not change MX records until the replacement mailbox and migration are verified; do not assume Gmail SMTP access is included merely because free webmail signup is offered.
