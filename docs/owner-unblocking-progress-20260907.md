# Owner unblocking verification — 7 September 2026

These are verified account and operations changes, not a new application deployment. Live checkout and bank connectivity remain disabled.

## TrueLayer

Owner signup and MFA enrolment completed. Created Casher sandbox application `sandbox-casher-b3ef06`. Console shows Data Active. The owner approved the step-up MFA challenge and Console confirmed a new sandbox secret. Its secure local availability and a successful Data V3 call remain unverified; frontend/consent/sync acceptance is not complete. No production account, signing key for payments, commercial upgrade or production connection was configured.

## Recovery

The owner clicked Start export. The completed export is visible in private bucket `database_export_07_09_26`, file `trycasher-com_260907.backup`, displayed size 502 KB. The Download control was invoked, but a local copy has not yet been verified. No restore has been performed. The browser downloads page is blocked by the browser URL policy; no browser download database or other bypass was used.

The older `.audit-results/recovery-drill` directory denied filesystem access in this session. A fresh `.audit-results/recovery-current` directory was created and its access verified, restricted to the current Windows owner and SYSTEM. Await the export in that directory before starting the network-isolated restore. The public repository must never contain the backup or credentials.

## Monitoring

Sentry GitHub association completed following owner approval. Casher project `4511223530258512` is accessible. The generic redacted test issue is visible. Enabled alert `483773` has a recorded trigger at 13:42 BST on 7 September, and its existing high-priority conditions were preserved. Changed recipient from suggested assignees/recently active members to the explicit existing owner member; the saved detail view confirms that destination. A Send Test Notification call returned **Notification fired!**. This verifies provider dispatch, not receipt in the owner's mailbox.

GitHub scheduled production health execution is now observed: [run 34144223617](https://github.com/DannyWolfofTech/Casher/actions/runs/34144223617), created at 16:38:47 UTC on 7 September, completed successfully. This establishes one real scheduled run; schedule regularity and receipt of failure notifications remain separate checks. A fresh local public production-health check passed all four checks: database/anonymous-profile denial, Auth availability, website/assets, and anonymous billing rejection.

## Email

`privacy@trycasher.com` already receives through forwarding; it is not yet a verified outbound mailbox. On Zoho's free business signup, the contact Email address is the owner's existing reachable account. The custom-domain mailbox is configured later with domain `trycasher.com` and mailbox name `privacy`. Signup, any required personal verification and terms must be completed by the owner. Do not change MX records until the replacement mailbox and migration are verified; do not assume Gmail SMTP access is included merely because free webmail signup is offered.
