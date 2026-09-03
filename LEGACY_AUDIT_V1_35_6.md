# Legacy Audit — v1.35.6

## Scope
Reviewed legacy/compatibility registry files and all repository references before deleting anything.

## Result

### Removed safely
- `lib/providers/legacy-registry.js`
  - No `require()`/`import` consumers found.
  - No runtime command, provider health, test, or documentation dependency found.
  - Contained only a preserved provider inventory and lookup helpers; it did not participate in provider routing.

### Retained intentionally
- `commands/legacy-registry.js` — despite the name, it is still actively loaded by `commands/registry-init.js` and contains registered command definitions. It is legacy in migration history, not dead code.
- `commands/registry-phase2d.js` — actively loaded by `registry-init.js`.
- `commands/registry-compat-aliases.js` — actively loaded by startup and referenced by audits; retained until compatibility coupling is removed deliberately.
- `commands/registry-init.js` — active registry bootstrap.

## Safety rule
No active registry file was deleted or renamed in this release. This avoids breaking command registration while reducing only proven-dead legacy provider inventory code.

## Next candidate
The next legacy cleanup target is the command registry bootstrap split. Before changing it, build a dependency/reference map and then consolidate only files proven redundant.
