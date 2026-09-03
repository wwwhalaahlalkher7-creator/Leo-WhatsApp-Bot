# Event Modules Audit — v1.35.20

## Result

Event handling is now split into three explicit modules:

- `events/messages.js` — message pipeline and command/message interactions.
- `events/group-participants.js` — group add/remove/promote/demote lifecycle.
- `events/status.js` — status/autostatus lifecycle.
- `events/index.js` — single wiring surface.

`main.js` now contains runtime bootstrap concerns only (temp directory, process handlers, globals) and exports the event surface.

## Safety

No command routing, permission policy, provider order, economy pricing, or event behavior was intentionally changed. The handlers were moved with their existing logic and dependencies.

## Verification

- JavaScript syntax check: PASS
- Event module contract test: PASS
- Storage abstraction contract test: PASS
