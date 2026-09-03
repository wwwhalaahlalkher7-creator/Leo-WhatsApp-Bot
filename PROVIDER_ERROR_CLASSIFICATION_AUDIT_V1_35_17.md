# Provider Error Classification Audit — v1.35.17

## Goal
Distinguish provider failures that justify circuit-breaker protection from permanent/request-specific failures that should immediately allow fallback without opening the provider circuit.

## Classification
- **Transient:** HTTP 408, 425, 429, 5xx, timeout/network/socket errors. These contribute to circuit opening.
- **Permanent:** HTTP 4xx and explicit invalid/unsupported/not-found/unauthorized/forbidden/bad-request signals. These do not open the circuit.
- **Unknown:** preserved as a normal failure and may contribute to the circuit threshold.

## Fallback metadata
Fallback errors now retain provider name, HTTP status, error code, and classification. This improves diagnostics without changing provider order.

## Validation
- Error classification regression test: PASS
- Permanent 403 repeated failures: circuit remains degraded
- Transient 503 repeated failures: circuit opens at configured threshold
- Fallback from permanent provider error to backup provider: PASS
- No provider order changes
