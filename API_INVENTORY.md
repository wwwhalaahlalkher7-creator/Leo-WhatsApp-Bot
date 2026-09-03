# Leo WhatsApp Bot — External Provider Inventory v0.2

The bot currently calls many unrelated public/free endpoints directly from command files. This is the main architectural target for the next pass.

## AI
- zellapi.autos
- vapis.my.id
- api.siputzx.my.id
- api.ryzendesu.vip
- api.giftedtech.my.id
- shizoapi.onrender.com
- api.princetechn.com
- okatsu-rolezapiiz.vercel.app

**Action:** create `lib/providers/ai/` and a provider failover policy.

## Downloaders
- eliteprotech-apis.zone.id
- api.yupra.my.id
- okatsu-rolezapiiz.vercel.app
- apis-keith.vercel.app
- api.siputzx.my.id

**Action:** create one downloader interface for YouTube/TikTok/Instagram/Facebook/Spotify instead of embedding URLs in each command.

## Images / Canvas / Text
- some-random-api.com
- shizoapi.onrender.com
- api.princetechn.com
- api.siputzx.my.id
- ephoto360.com

**Action:** isolate each provider and make failures non-fatal.

## Translation / information
- translate.googleapis.com
- api.mymemory.translated.net
- api.dreaded.site
- opendb/opentdb
- uselessfacts.jsph.pl
- icanhazdadjoke.com
- OpenWeather
- NewsAPI

**Action:** centralize HTTP clients, timeouts, response validation and API keys.

## Upload / temporary media
- qu.ax
- telegra.ph
- uguu.se
- ezgif.com

**Action:** central uploader with size/type/time limits.

## Important security finding

Any provider key/token embedded in source must be rotated and moved to `.env`. The new code must never commit real secrets.

## Runtime compatibility finding

The current project declares Node `>=18`, while current Baileys documentation states Node.js `20.0.0+` is required, and Baileys 7.x introduced breaking changes. The next dependency pass should therefore target Node 20+ and explicitly test the installed Baileys version before changing production behavior.
