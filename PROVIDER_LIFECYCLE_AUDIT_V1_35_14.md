# Provider Lifecycle Audit — v1.35.14

## Scope

This release hardens the shared provider transport and health lifecycle without changing provider order or user-facing pricing.

## Changes

1. Core HTTP JSON/buffer requests now use `AbortController` in addition to Axios timeouts.
2. Downloader requests now explicitly abort when their timeout expires.
3. OmniRoute API calls and direct generated-media downloads now have explicit abort timers.
4. Health probes now use the same circuit lifecycle as normal provider calls, including half-open probe serialization.
5. Invalid provider health environment values no longer produce `NaN`/zero behavior; safe positive defaults are used.

## Deliberate non-changes

- No provider order changes.
- No new external provider dependencies.
- No automatic global timeout wrapper around third-party SDK calls that cannot accept cancellation; racing such calls would leave work in-flight and would falsely claim resource cleanup.
- No change to command prices.

## Verification

- JavaScript syntax checks passed for all modified provider files.
- Full live provider verification remains environment-dependent because this analysis workspace does not contain the production `node_modules` or live provider credentials.
