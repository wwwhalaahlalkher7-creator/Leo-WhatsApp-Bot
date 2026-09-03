# Leo Bot v1.35.4 — Deployment Notes

## Railway / Docker runtime

The Docker image uses Node.js 22 and installs the external PDF runtime required by the bot:

- FFmpeg
- LibreOffice (`soffice`)
- Poppler (`pdftoppm`)
- Ghostscript (`gs`)
- Python 3 + PyMuPDF + python-docx + openpyxl + python-pptx

The container prefers `npm ci` when `package-lock.json` is present and falls back to `npm install` for repositories that have not generated a lockfile yet.

## Package lock

A `package-lock.json` should be generated and committed from a network-enabled Node.js environment before the final production release. This source archive was prepared in an environment without access to the npm registry, so the lockfile could not be generated here without fabricating dependency resolution data.

Recommended command:

```bash
npm install --package-lock-only --legacy-peer-deps --no-audit --no-fund
git add package-lock.json
git commit -m "chore: lock production dependencies for v1.35.4"
```

## Startup backup

The startup backup block in `index.js` is now real executable JavaScript instead of a literal `\n`-escaped comment line.
