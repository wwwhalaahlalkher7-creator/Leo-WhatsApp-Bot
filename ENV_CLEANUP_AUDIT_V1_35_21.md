# Leo WhatsApp Bot v1.35.21 — Environment Cleanup Audit

This build keeps `.env.example` limited to values that are deployment-specific, secret, or genuinely required to select an external service endpoint/model.

## Kept in `.env.example`

- WhatsApp/deployment identity: `OWNER_NUMBER`, `BOT_NUMBER`, `PAIRING_CODE`
- Channel deployment values: `CHANNEL_JID`, `CHANNEL_LINK`, `CHANNEL_NAME`
- OmniRoute credentials/endpoint: `OMNIROUTE_API_KEY`, `OMNIROUTE_BASE_URL`
- OmniRoute model selectors: `OMNIROUTE_TEXT_MODEL`, optional `OMNIROUTE_TTS_MODEL`
- Fallback credentials: `OPENAI_API_KEY`, `GEMINI_API_KEY`, `GIFTED_API_KEY`
- Cloudflare credentials: `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`
- Hugging Face credential: `HF_TOKEN`
- Independent service credentials: `PRINCE_API_KEY`, `SHIZO_API_KEY`, `REMOVEBG_API_KEY`, `TENOR_API_KEY`

## Removed from `.env.example` and hardcoded to the existing application defaults

- AI context/document/media limits
- Bot branding/language/persona defaults
- APK service URL and limits
- Cloudflare model/steps/daily image limit
- HF public Space/model parameters (token remains env)
- OpenAI/Gemini model, temperature and enable flags
- OmniRoute feature flags and non-secret tuning defaults
- OmniRoute image/video/STT/audio-translation tuning
- TTS format/voice defaults and Google-TTS disable switch
- PDF limits
- Provider health thresholds/cooldown
- Backup startup/retention behavior
- Memory/reconnect/conflict-reconnect limits
- Economy currency and initial balance
- Work cooldown
- Update URL/host allowlist/size limit
- Legacy API URL registry in `config.js`
- Sticker metadata and general bot identity defaults

## Removed because they had no live consumer

The root `config.js` contained a legacy API URL/key registry that was not consumed anywhere except the `WARN_COUNT` value used by anti-link moderation. The dead API registry was removed; `WARN_COUNT` is now a code constant.

## Conflict fix

`CONFLICT_RECONNECT_MAX` and `CONFLICT_RECONNECT_DELAY_MS` are now code constants:

- max attempts: `3`
- conflict delay: `15000 ms`

## Intentionally retained as environment variables

Secrets and deployment-specific values are not hardcoded. In particular, API keys/tokens, WhatsApp identity numbers, channel identifiers, OmniRoute endpoint, and optional OmniRoute model selectors remain configurable through the environment.

## Verification

- JavaScript syntax check: PASS (214 files)
- Provider fallback quality test: PASS
- Provider normalization test: PASS
- Provider error classification test: PASS
- Command contract test: PASS
- Event modules/storage abstraction test: PASS
- `npm test`: PASS

Note: `main.js` still assigns `process.env.TMPDIR`, `TEMP`, and `TMP` internally to the application's managed temp directory. These are runtime assignments, not user configuration variables, and are intentionally absent from `.env.example`.
