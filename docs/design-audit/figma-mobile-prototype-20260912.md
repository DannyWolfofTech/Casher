# Casher mobile prototype — 12 September 2026

Created **Casher · Mobile prototype v1** in the owner's Figma workspace. This is the proposed mobile design for review before implementation. No application source, backend, installed mobile build or deployment changed during this design pass.

- [Open the interactive prototype](https://www.figma.com/proto/HFA81FN7TV8hqVpSXXMmh1/Casher-Mobile-prototype-v1?node-id=7-2&scaling=scale-down&content-scaling=fixed&page-id=0%3A1&starting-point-node-id=7%3A2&show-proto-sidebar=1)
- [Open the editable design file](https://www.figma.com/design/HFA81FN7TV8hqVpSXXMmh1/Casher-Mobile-prototype-v1)

## Design decisions

Four persistent, labelled destinations: **Overview, Activity, Subscriptions and Goals**. Account is a header action. Import is contextual to statements and activity; goal creation belongs to Goals. This follows the separation of navigation and actions in [Apple's tab-bar guidance](https://developer.apple.com/design/human-interface-guidelines/tab-bars).

Overview prioritises spending, income, the selected month and the actual import coverage. Compact category rows and renewal previews replace competing dashboard cards. Activity uses date-grouped transactions. Subscription amounts are described as estimated costs, and recording a cancellation is separate from cancelling with a provider. Goals record money saved elsewhere; Casher does not move funds.

The structure draws on [Apple's layout guidance](https://developer.apple.com/design/human-interface-guidelines/layout), the [Lloyds spending-insights flow viewed on Mobbin](https://mobbin.com/flows/721c6d4b-8624-44f6-8bd0-76973f1a52cf?tab=screens), and the [earlier competitor comparison](budgetbuddy-comparison-20260911.md). The Apple library was discoverable but rejected component import. The prototype therefore uses original local Casher components; it is not an Apple-approved design or a copy of another app.

## Original brand retained

Values were verified against `src/index.css` and `tailwind.config.ts` at application HEAD `c447392fa98e0986bb3fb55698c3b7696eb1132d`.

| Role | Value |
| --- | --- |
| Background | Cream `#F5F1EB` |
| Text | Navy `#1A247F` |
| Primary action | Green `#1B7449` |
| Surface | `#F8F6F1` |
| Muted surface | `#E7E2DA` |
| Secondary text | `#474E85` |
| Border | `#CFD1E2` |
| Destructive | `#B81E1E` |
| Wordmark | Instrument Serif Italic |
| Interface | Inter |

The file contains 38 variables, nine shared text styles, five component families (button, row, tab bar, category chart and monthly chart) and auto-layout screens. Primary buttons are 52 points high; rows are 72 points; interactive targets are at least 44 × 44 in this prototype. This is the original light colour theme.

## Prototype coverage

There are **34 screens and states**, at 393 × 852, with six presentation starting points: Everyday use, First statement, Offline recovery, Invalid file, Account deletion and Charts & insights.

| Area | Included |
| --- | --- |
| Overview | September/August, month selection, prominent Charts & insights entry, example and offline states |
| Activity | Signed, date-grouped transactions, merchant logos, representative detail and category editing |
| Subscriptions | Upcoming renewal dates, merchant logos, monthly/annual estimates, provider guidance and cancellation tracking |
| Charts & insights | Ranked category bars with amounts/shares, monthly spending bars, income/spending figures and explicit partial-month coverage |
| Goals | Existing goals, contextual update form, add form and created state |
| Statements | First use, file choice, checking, review, success, invalid file and CSV help |
| Account/data | Account, imports, reset explanation, password/typed confirmation, cleared state, deletion explanation/verification/result |

All financial examples and the displayed identity are invented. File selection and destructive actions simulate transitions inside Figma. Verification forms show example completed inputs; they do not receive real passwords or enforce authentication.

## Checks performed

Clicked through in Figma presentation using the Mac browser:

- Overview → Activity → Tesco → category editor. Saving Dining updates the detail; choosing Shopping and dismissing leaves Dining saved.
- First use → CSV selection → checking → review → import success.
- Subscriptions → Netflix → mark cancelled → confirmation → revised subscription list and totals (£56.99 monthly, £683.88 annual estimate).
- Goals → Summer holiday update, confirming the correct goal name, target, progress and date.
- Offline → Retry → Overview; invalid file → choose another file → import screen.
- Account → statements → clear explanation → verification → imports cleared.
- Account deletion starting flow → verification → account deleted.

The latest structural audit found **zero immediate auto-layout text overflow findings and zero interactive targets below 44 × 44**, across 34 screens and 196 nodes with prototype reactions. Long screens intentionally scroll inside a fixed content viewport. This audit does not prove every possible clipping, overlap or accessibility condition.

Calculated contrast on the original cream: navy 11.65:1, secondary text 6.92:1 and green 5.13:1. White on green is 5.77:1; white on destructive red is 6.48:1. These are selected colour-pair calculations, not a complete accessibility certification.

## Scope limits and implementation handoff

The prototype demonstrates representative journeys. Search/filter input, preferences, export/share sheets, free typing, validation errors, full keyboard behaviour and every merchant detail are not fully interactive. Category edits do not recalculate the whole dashboard. Reset/cancellation result screens are illustrative states, not a persistent simulated database across every tab.

Before implementation, review the density, typography and four-tab navigation in the linked prototype. Then implement the agreed components and navigation in the existing app, preserving authentication, quotas, GBP limitations, import idempotency, data-reset receipts and all release restrictions. Preserve the existing recent-sign-in/password checks and exact `CLEAR`/`DELETE` confirmation rules in `ClearStatementData.tsx` and `Account.tsx`; prototype navigation must not replace server enforcement.

Implementation acceptance still needs narrow/large-text/landscape/dark layouts, keyboard avoidance, screen-reader semantics, native Files/share integration and measured loading behaviour on a physical iPhone. This design pass does not resolve the release blockers recorded in `docs/MAC-HANDOFF.md`.

## Saved previews and evidence

- [Overview](assets/figma-mobile-v1/overview.png)
- [Activity](assets/figma-mobile-v1/activity.png)
- [Subscriptions](assets/figma-mobile-v1/subscriptions.png)
- [Goals](assets/figma-mobile-v1/goals.png)
- [Account](assets/figma-mobile-v1/account.png)
- [Category charts and statistics](assets/figma-mobile-v1/category-insights.png)
- [Monthly chart](assets/figma-mobile-v1/monthly-insights.png)
- [Reset verification](assets/figma-mobile-v1/reset-verification.png)
- [Deletion verification](assets/figma-mobile-v1/deletion-verification.png)
- [Final screen/component audit](assets/figma-mobile-v1/audit.json)

The local ignored `.audit-results/figma-mobile-v1/` directory retains creation scripts and MCP evidence. The Figma file is the editable design source; scripts are incremental build records and must not all be replayed over the existing file. No spending, purchase, legal acceptance, banking/checkout activation, app submission or real account/data deletion occurred.

## Owner feedback incorporated

Activity money-out values now have an explicit minus sign, including the transaction detail and editor; income retains its plus sign. For example, Tesco shows **−£43.20** and Salary **+£3,200.00**. Activity describes recorded transactions. Subscriptions describes upcoming recurring payments, gives an expected date on each row, and separates monthly and annual cost estimates.

The Account D/A/L/?/P placeholders were replaced with document, appearance, language, help and privacy icons from the app's installed Lucide library. Generic salary, rent, energy, cloud and statement records also use relevant icons. The SVG sources and their ISC notice are retained alongside the design assets.

Netflix, Tesco, Spotify and PureGym use real merchant artwork sourced from their official websites. The fictional “Fitness club” fixture was renamed PureGym while keeping its illustrative £35.00 amount; it is not a claim about the provider's current price. Brand colours belong to the logos; Casher's interface palette is unchanged.

Logo sources: [Netflix's site icon](https://assets.nflxext.com/us/ffe/siteui/common/icons/nficon2016.png), [Tesco's corporate logo](https://www.tescoplc.com/media/svnf5ixc/tesco-logo.svg), [Spotify's site icon](https://open.spotifycdn.com/cdn/images/favicon32.b64ecc03.png), and the embedded logo on [PureGym's official About page](https://www.puregym.com/about-us/). Asset provenance is recorded in `assets/figma-mobile-v1/merchant-assets/sources.json`. These are prototype assets; sourcing does not itself establish permission for every production/marketing use.

For app implementation, add a curated merchant identity map: normalise statement descriptors, match known aliases to a canonical merchant, and display a bundled logo with a category-icon fallback for unknown merchants. Do not infer a known brand solely from a generic category such as “gym.” Keep raw statement text available for corrections. No runtime merchant recognition or logo service was added in this design pass.

### Subsequent signed-in retry and broader merchant coverage

Figma Design and Present now load in the owner's Chrome session. Fresh live checks passed Overview → category insights → monthly insights → categories and scrolling to the lower categories. Activity displayed negative expense amounts and a positive salary; Subscriptions displayed expected dates, cadence and monthly/annual estimates. This supersedes the earlier blank-browser limitation for those checks.

The [merchant identity handoff](merchant-identities-20260912.md) adds 32 prepared brand assets, recorded provenance, the [Figma logo board](https://www.figma.com/design/HFA81FN7TV8hqVpSXXMmh1/Casher-Mobile-prototype-v1?node-id=50-636), and store/café fallback rows. The Spotify image was replaced with a sharper vector-derived image. The catalogue is a design foundation, not measured universal merchant coverage or an implemented upload-time lookup. The file still has 34 mobile screens, six flows and five component families, plus the new reference board.

Charts now have a visible Overview entry and their own starting flow. The category view uses horizontal bars with exact amounts and percentages. The monthly view uses a shared zero-based scale and labels August as full and September as only 1–2 September. No percentage trend or claimed savings is computed across unequal coverage. Income minus spending is explicitly not presented as a bank balance.

The updated screenshots and node audit were verified through Figma. A fresh browser presentation retest returned a blank page after reload; the in-app browser separately required a Figma login and was closed without changing authentication or sharing. Therefore the earlier clickthrough evidence above remains historical: do not claim that the new chart navigation was manually retested successfully. Its destinations and component structure are recorded in the final audit and creation scripts. The updated PNG previews are available for immediate review.

## Implementation and authentication extension

The owner's subsequent full-implementation request is recorded in [the implementation report](mobile-implementation-20260912.md). Four authentication screens and a reusable form-field component extend this file to 38 mobile screens/states. The new sign-in starting screen is [62:652](https://www.figma.com/design/HFA81FN7TV8hqVpSXXMmh1/Casher-Mobile-prototype-v1?node-id=62-652). The implementation retains real security and data rules rather than copying simulated prototype results. In particular, recorded first/last transaction dates do not establish full-month coverage, even where earlier illustrative screenshots say “Full month.”
