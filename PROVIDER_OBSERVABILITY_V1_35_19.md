# Provider Observability — v1.35.19

The owner dashboard exposes the provider lifecycle without exposing request payloads or user identifiers.

## Recorded session telemetry
- Retry: provider, attempt number, delay, status/code and error classification.
- Fallback: operation, provider, outcome, classification/code and concise reason.
- Provider health: circuit status, successes, failures, last error and latency.
- Retry policy: max retries, exponential backoff limits and Retry-After cap.

## Bounds
- Provider telemetry is in-memory and capped at 40 retry + 40 fallback events.
- Command telemetry is persistent but bounded to one latest record per command.
- No message body, phone number or chat ID is stored by these telemetry layers.
