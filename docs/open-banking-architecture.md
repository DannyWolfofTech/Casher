# Open Banking status — 7 September 2026

TrueLayer Data V3 is selected for the real UK sandbox integration. See [the provider comparison and exact access boundary](open-banking-provider-selection.md).

The former V1 prototype has been retired to `experiments/retired-open-banking-v1` as text, including its migrations and synthetic tests. It is not a deployed integration, a provider-backed sandbox or part of the release acceptance suite. No live bank connections are enabled.

The owner created the Console account and enrolled MFA on 7 September. The Casher sandbox application is `sandbox-casher-b3ef06`, with Data marked Active. Its sandbox credential is now verified and stored in a private directory with a DPAPI-encrypted copy. Real authentication succeeded for existing scopes, but the documented V3 `data` scope returned `invalid_scope` and `/v3/data-connections` returned 403. The owner-authorized enablement request was sent to TrueLayer Support and escalated to a human; the provider confirmed it will reply by email because support is offline. No successful V3 connection exists. Production separately requires verified commercial, regulatory, credential and data-protection approval.
