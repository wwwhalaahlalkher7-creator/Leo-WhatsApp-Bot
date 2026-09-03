# Economy Audit — v1.35.13

## Scope
Consolidate paid command charge/refund lifecycle without changing configured prices.

## Result
- `systems/economy/index.js` now exposes `runPaid()`.
- `runPaid()` performs one charge, executes the task, and refunds once on failure.
- Refund failures are preserved on the original error for observability.
- Migrated paid handlers: `ai`, `imagine`, `image-search`, `sora`, `song`, `video`.
- No direct `economy.chargeFor()` / `economy.refundFor()` remain in active paid handlers.
- Current economy prices remain zero by configuration; this release does not activate or alter pricing.

## Validation
- Paid economy regression test: PASS
- JavaScript syntax: PASS
- Existing registry/storage/contract audits: PASS

## Deliberate non-change
Game-specific economy flows remain unchanged because their lifecycle includes game-state-specific refunds/rewards and should be consolidated only with dedicated transaction semantics.
