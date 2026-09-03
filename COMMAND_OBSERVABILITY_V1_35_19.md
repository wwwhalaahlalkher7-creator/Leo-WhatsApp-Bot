# Command & Provider Observability — v1.35.19

## Owner commands
- `.مراقبة` — dashboard summary.
- `.مراقبة الأوامر` — latest status for every visible/help command: unused, success, or failure with reason.
- `.مراقبة المزودات` — provider lifecycle status, retry policy, classification, fallback/normalization state, failures and latency.

## Command telemetry
- Stored in `data/command-observability.json`.
- One latest record per registered command; no unbounded per-invocation history.
- Records status, timestamp, duration and failure reason.
- Permission, interaction and cooldown rejections are recorded as failures.
- Handler exceptions are recorded as failures; provider error details are summarized without sender identifiers.

## Privacy
- No sender phone number, message body or chat ID is persisted by command telemetry.
- Provider dashboard uses current in-process circuit state.
