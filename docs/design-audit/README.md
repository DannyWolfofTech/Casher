# Casher release design audit — 7 September 2026

The released web core supports statement import, review, history, account export and deletion. The product as a whole is not yet launch-approved: outbound privacy replies, legal operator details, fresh Stripe acceptance and mobile/provider gates remain open. [Release acceptance](../release-acceptance-20260907.md) is authoritative for current versions and results. The [4–6 September report](audit-20260904.md) is historical evidence, not the current deployment status.

## Environment and evidence

The actual local site was booted and inspected through the Codex in-app Browser on desktop and mobile. The actual production custom domain was inspected through the same browser, including landing, pricing and navigation. Public production Playwright checks use live HTTP responses without backend fixtures. Authenticated production API/device checks use one deliberately created test identity with four synthetic records; no real customer statement was exported.

The separate UI regression suite uses invented responses, covers 320/390/768/1440 widths, dashboard/charts/history/import errors/empty states/dark mode/account dialogs and seven About languages. Those screenshots demonstrate UI behavior, not a bank connection or paid entitlement. Hosted Linux CI caught French/Polish overflow that Windows did not; wrapping was fixed instead of weakening the assertion.

## Changes and findings

| Priority | Finding and user impact | Resolution / remaining work |
|---|---|---|
| P0 | New paid sales lack fresh provider lifecycle acceptance and complete operator details. | Both backend and frontend sales gates remain off; existing billing management stays available. Owner actions in release acceptance. |
| P0 | Privacy contact receives mail, but normal replies expose the forwarding mailbox. | External delivery verified; a domain SMTP sender and send-as configuration still require owner provider signup. |
| P1 | Legacy transactions lack direction and cannot reliably imply spending. | Visible warnings and deliberate correction/review tools; no guessed backfill. Original statements needed to repair lost information. |
| P1 | SPA navigation retained the old page's scroll position. | Route changes reset scroll; a browser regression checks the pricing heading appears at the top. |
| P1 | French/Polish About text overflowed at 320px under Linux fonts. | Flexible content and footer wrapping; language checks retained. |
| P1 | Bank, security and subscription marketing implied unavailable certainty/features. | Removed absolute-security language, Premium offering and fake admin revenue; possible-subscription wording and provider-side cancellation disclosures agree. Real bank connectivity stays disabled. |
| P1 | Operational-email unsubscribe link had no working public destination. | Added deliberate token confirmation, private service-only lookup, suppression and production route. |
| P2 | Wide pricing comparison and small mobile controls reduced readability. | Two real product tiers, responsive table, larger native targets and input text, safe areas. |
| P2 | Main entry bundle is over 500kB minified. | Route splitting already present; remains a measured performance risk on slow devices, not a failed build. |

## Screenshot inventory

Live custom-domain screenshots, each in desktop 1440px and mobile 390px versions:

- `assets/live-20260907-home-{1440,390}.png`
- `assets/live-20260907-pricing-{1440,390}.png`
- `assets/live-20260907-auth-{1440,390}.png`
- `assets/live-20260907-privacy-{1440,390}.png`
- `assets/live-20260907-terms-{1440,390}.png`
- `assets/live-20260907-unsubscribe-{1440,390}.png`

Representative before/after fixture evidence: `before-dashboard-desktop.png`, `after-dashboard-desktop.png`, `after-dashboard-1440.png`, `after-history-desktop.png`, `after-empty-mobile.png`, `after-import-error-mobile.png`, `after-legacy-data-warning.png`, and `after-public-{about,auth,home,pricing,privacy}-320.png`. The historical report contains the earlier full inventory. Existing screenshot files were preserved and refreshed where the regression suite generated a new result.

## 5 Issues Hurting Conversion Most

1. New Pro subscriptions must remain paused until payment acceptance and business disclosures are complete.
2. Privacy inquiries lack a configured domain reply sender, limiting support trust.
3. Automatic bank connection is unavailable; users must export a CSV themselves.
4. Older ambiguous records require review before users can trust historical totals.
5. Mobile release/store acceptance and slow-device performance still need broader evidence.

## 5 Quick Wins Fixable Today

1. Completed: reset page scroll during navigation so users see the destination heading.
2. Completed: wrap long translated disclosure/footer text at 320px.
3. Completed: use “possible subscriptions” and explain cancellation occurs with the service provider.
4. Completed: provide account export/deletion to every plan and remove misleading Premium promotion.
5. Completed: make email preference links work and disclose the real privacy-mail delivery limitations.
