# LeoBot Core Systems

This directory is the shared-system layer for the refactor. Existing commands are intentionally not migrated in this stage.

## Systems

- `command/` — command normalization, tokenization, multi-word command parsing and command definition helpers.
- `interaction/` — reply, reply-number and reply-action contracts.
- `session/` — reusable owner/chat/message-bound sessions with TTL and active-message rotation.
- `economy/` — new currency/economy facade over the legacy store; no legacy prices are changed here.
- `permission/` — canonical permission policy/checking.
- `response/` — centralized text/media/reaction response helpers.
- `input/` — text, reply, mention, media and Arabic-number extraction.
- `cooldown/` — reusable in-memory cooldown contract.
- `provider/` — provider definition and ordered fallback execution.

## Refactor rule

Commands should migrate one at a time. A command should use the smallest shared system that fits it and add a local adapter only when its business logic genuinely needs specialization.

Do not move command files during this phase. File relocation is a final cleanup step after migration and regression testing.
