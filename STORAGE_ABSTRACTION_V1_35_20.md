# Storage Abstraction — v1.35.20

## Domain storage

`lib/storage/index.js` is now the public facade for bot-owned JSON data. It exposes the safe `JsonStore` operations without making callers depend on the concrete implementation path.

`lib/data-store.js` remains as a compatibility alias so older modules do not break. Direct consumers of `lib/storage/json-store.js` were removed outside the implementation and its focused storage tests.

## Intentional separation

`lib/lightweight_store.js` remains separate because it is a Baileys-specific message/contact/chat cache with event binding and bounded message retention. It is not a generic domain database and should not be forced behind the JSON domain facade.
