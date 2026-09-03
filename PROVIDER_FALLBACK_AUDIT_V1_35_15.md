# Provider Fallback Quality Audit — v1.35.15

## Scope

This release hardens fallback correctness after the lifecycle work in v1.35.14. The goal is to prevent a provider that technically returned a value from being treated as successful when the value cannot actually be consumed by the bot.

## Changes

1. Downloader fallback now validates returned media URLs before accepting a provider result.
2. Invalid/empty media results are converted into provider failures so the next provider can run.
3. Fallback keeps the existing provider order; no provider was promoted or removed.
4. Kitsu now exposes `getById`, allowing a Kitsu search result to be resolved instead of becoming a dead-end result.
5. Added `scripts-provider-fallback-quality-test.js` and `npm run test:provider-fallback`.

## Deliberate non-changes

- No user-facing pricing changes.
- No new external dependencies.
- No automatic retry multiplication.
- No change to AI/provider ordering.

## Verification

- Provider fallback regression test: PASS.
- Modified provider files: syntax checks PASS.
- Full live provider verification remains environment-dependent because this workspace does not contain production `node_modules` or live provider credentials.
