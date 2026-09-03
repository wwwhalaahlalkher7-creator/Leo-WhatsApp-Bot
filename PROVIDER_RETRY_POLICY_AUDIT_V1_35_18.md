# Provider Retry Policy Audit — v1.35.18

## Scope

This release adds a bounded retry policy to the shared provider orchestration layer.

## Policy

- Default: **1 retry** for transient provider failures.
- Retryable: HTTP 408/425/429, HTTP 5xx, timeout/network errors classified as transient.
- Non-retryable: HTTP 4xx permanent failures, empty/invalid results, circuit-open/probe-in-progress errors.
- `Retry-After` is honored for numeric seconds and HTTP-date values, capped by `retryAfterMaxMs` (default 10s).
- Without `Retry-After`, exponential backoff starts at 400ms and is capped at 5s.
- Provider-specific policy can override `maxRetries`, `retryBaseDelayMs`, `retryMaxDelayMs`, and `retryAfterMaxMs`.

## Safety

Retries are bounded and occur before the next provider fallback. Circuit-open states are never retried, preventing needless delay when a provider is already known to be unavailable.

## Verification

- Provider retry policy tests: PASS.
- Existing provider error classification/fallback tests remain required.
- Live external-provider certification still requires the Railway production dependency environment.
