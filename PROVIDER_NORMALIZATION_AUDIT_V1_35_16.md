# Provider Result Normalization Audit — v1.35.16

## Scope

This release hardens the boundary between external providers and the bot's internal media/anime consumers.

## Changes

- Added `lib/providers/core/normalize.js` as the canonical normalization boundary.
- Media provider outputs now accept common URL field variants (`download`, `video`, `audio`, `downloadUrl`, etc.) and emit stable `media` items.
- Invalid/non-HTTP media URLs are rejected before a provider is considered successful.
- Duplicate media URLs are removed while preserving provider order.
- Media results expose a canonical `download` alias when only a `video` URL exists.
- Anime search results are normalized before ranking/merging so malformed provider records cannot enter the shared result set.
- Provider-specific metadata remains preserved where the existing contract supports it.

## Compatibility

No provider priority, API endpoint, configured price, or user-facing command behavior was intentionally changed.

## Verification

- Provider normalization regression: PASS
- Provider fallback regression: PASS
- JavaScript syntax check: PASS — 200 files
- External provider live verification: not claimed in the local environment because production dependencies/credentials are unavailable here.
