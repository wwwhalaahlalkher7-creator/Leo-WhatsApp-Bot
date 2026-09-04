'use strict';
const assert = require('assert');
const fs = require('fs');

const registry = fs.readFileSync('commands/registry-core.js', 'utf8');
const provider = fs.readFileSync('lib/providers/ai/index.js', 'utf8');
const ai = fs.readFileSync('commands/ai.js', 'utf8');

assert(/name:'ai'/.test(registry), 'Leo AI registry entry is missing');
assert(/localizedAliases:\['ليو'\]/.test(registry), 'Leo must be the single public AI command name');
assert(!/localizedAliases:\[[^\]]*شاتو/.test(registry), 'Provider name شاتو must not be exposed as a public AI command');
assert(!/localizedAliases:\[[^\]]*جيمني/.test(registry), 'Provider name جيمني must not be exposed as a public AI command');
assert(/providers\s*=\s*\[/.test(provider), 'AI provider router missing');
assert(/for \(const provider of ordered\)/.test(provider), 'AI fallback loop missing');
assert(/excludeProviders/.test(provider), 'AI provider exclusion/fallback support missing');
assert(/await ai\.chat\(/.test(ai), 'Leo command is not routed through the central AI system');
assert(/reason: `ai:\${mode}`/.test(ai), 'Leo economy integration missing');

console.log('PASS: .ليو is the single public AI interface; provider selection/fallback remains internal.');
