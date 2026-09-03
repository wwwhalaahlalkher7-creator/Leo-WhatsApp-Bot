'use strict';

const assert = require('assert');
const observability = require('./systems/observability');

assert.strictEqual(observability.reasonFromError({ message: 'boom' }), 'boom');
assert.strictEqual(
  observability.reasonFromError({ providerErrors: [{ provider: 'A', classification: 'transient', code: '429', error: 'rate limit' }] }),
  'A/transient [429]: rate limit'
);
assert.strictEqual(
  observability.reasonFromError({ providerErrors: [
    { provider: 'A', error: 'bad' }, { provider: 'B', error: 'timeout' },
    { provider: 'C', error: 'x' }, { provider: 'D', error: 'ignored' }
  ] }),
  'A: bad | B: timeout | C: x'
);
assert.ok(observability.FILE.endsWith('command-observability.json'));
console.log('Command observability tests: PASS');
