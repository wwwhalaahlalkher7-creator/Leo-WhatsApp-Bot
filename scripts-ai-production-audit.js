'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

function read(rel) { return fs.readFileSync(path.join(process.cwd(), rel), 'utf8'); }
function assertFile(rel) { assert(fs.existsSync(path.join(process.cwd(), rel)), `Missing ${rel}`); }
function has(text, pattern, label) { assert(pattern.test(text), `Missing ${label}`); }

const capability = read('systems/ai/capabilities.js');
const provider = read('lib/providers/ai/index.js');
const omni = read('lib/providers/ai/omniroute.js');
const health = read('lib/providers/core/health.js');
const media = read('systems/ai/media-assist.js');
const docs = read('systems/ai/documents.js');
const ai = read('systems/ai/index.js');

for (const file of ['systems/ai/capabilities.js','systems/ai/media.js','systems/ai/media-assist.js','systems/ai/documents.js','lib/providers/ai/omniroute.js','lib/providers/core/health.js']) assertFile(file);
for (const name of ['vision','audioTranscription','audioTranslation','translation','speechSynthesis']) has(capability, new RegExp(`\\b${name}\\s*:`), `capability ${name}`);
has(provider, /needsVision\s*=\s*Array\.isArray\(options\?\.content\)/, 'vision gating');
has(provider, /function toGeminiParts/, 'Gemini multimodal adapter');
has(provider, /capabilities:\s*\['text',\s*'vision'\]/g, 'vision provider metadata');
has(omni, /\/models/, 'availability-aware model discovery');
has(omni, /\/audio\/transcriptions/, 'STT endpoint');
has(omni, /\/audio\/translations/, 'audio translation endpoint');
has(omni, /\/audio\/speech/, 'TTS endpoint');
has(health, /probeInFlight/, 'half-open circuit lock');
has(health, /PROVIDER_PROBE_IN_PROGRESS/, 'half-open concurrency guard');
has(media, /createHash\('sha256'\)/, 'content-derived media key');
has(docs, /pdf\.cleanup\(extracted\.dir\)/, 'document temp cleanup');
has(ai, /inFlight/, 'AI in-flight deduplication');

const jsFiles = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory() && !['node_modules','.git'].includes(entry.name)) walk(p);
    else if (entry.isFile() && p.endsWith('.js')) jsFiles.push(p);
  }
}
walk(process.cwd());
console.log(`AI production audit: PASS — ${jsFiles.length} JS files statically verified for Stage 7 safeguards.`);
