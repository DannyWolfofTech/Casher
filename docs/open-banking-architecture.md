# Open Banking status — 7 September 2026

TrueLayer Data V3 is selected for the real UK sandbox integration. See [the provider comparison and exact access boundary](open-banking-provider-selection.md).

The former V1 prototype has been retired to `experiments/retired-open-banking-v1` as text, including its migrations and synthetic tests. It is not a deployed integration, a provider-backed sandbox or part of the release acceptance suite. No live bank connections are enabled.

The owner created the Console account and enrolled MFA on 7 September. The Casher sandbox application is `sandbox-casher-b3ef06`, with Data marked Active. A sandbox client secret was created after the owner's MFA challenge; secure local availability and the first successful Data V3 request are still pending. An active Data product is not yet proof of V3 access. Production separately requires verified commercial, regulatory, credential and data-protection approval. The current decision document records all remaining connection, consent, sync, reconciliation, revocation and deletion acceptance work.
