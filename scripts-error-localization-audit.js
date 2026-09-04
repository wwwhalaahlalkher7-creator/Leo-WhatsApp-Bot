const fs = require('fs');
const path = require('path');

const ROOTS = ['commands', 'lib', 'systems'];
const files = [];
function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile() && full.endsWith('.js')) files.push(full);
  }
}
ROOTS.forEach(walk);

const leaks = [];
const providerWords = /\b(?:Sora|OmniRoute|OpenAI|Gemini|Cloudflare|ClearBackdrop|Wikimedia|Wikipedia|remove\.bg)\b/i;
const dangerousErrorInterpolation = /(?:\$\{\s*(?:e|err|error|sendError)[^}]*\.message|\$\{\s*String\([^)]*(?:e|err|error)[^)]*\)\s*\})/;

for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    if (dangerousErrorInterpolation.test(line) && /sendMessage|response\.text|response\.media|return .*text/i.test(line)) {
      leaks.push(`${file}:${i + 1}: raw error detail may reach user`);
    }
    if (providerWords.test(line) && /sendMessage|response\.text|caption:\s*['"`]/i.test(line)) {
      leaks.push(`${file}:${i + 1}: internal provider name may reach user`);
    }
  });
}

if (leaks.length) {
  console.error('❌ Error/localization audit failed');
  console.error(leaks.join('\n'));
  process.exit(1);
}
console.log(`✅ Error/localization audit passed (${files.length} JS files scanned)`);
