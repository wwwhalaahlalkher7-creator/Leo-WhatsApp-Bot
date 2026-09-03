'use strict';
const assert = require('assert');
const research = require('./systems/ai/research');
const response = require('./systems/ai/response');

assert.equal(research.detectResearchNeed('ما هو آخر خبر اليوم؟'), 'required');
assert.equal(research.detectResearchNeed('هل صحيح أن هذا حدث؟'), 'required');
assert.equal(research.detectResearchNeed('اشرح لي مفهوم recursion'), 'none');
assert.equal(research.detectResearchNeed('أعطني المصدر الرسمي'), 'required');

const sources = research.formatSources([
  { uri: 'https://example.com/a', title: 'مصدر أول' },
  { uri: 'https://example.com/a', title: 'مكرر' },
  { uri: 'https://example.com/b', title: 'مصدر ثان' },
]);
assert(sources.includes('مصدر أول'));
assert(sources.includes('مصدر ثان'));
assert.equal((sources.match(/https:\/\/example\.com\/a/g) || []).length, 1);

assert.equal(response.cleanAiPrefix('جواب:\n\nالمعلومة الصحيحة'), 'المعلومة الصحيحة');
assert.equal(response.cleanAiPrefix('?\n\nالمعلومة الصحيحة'), 'المعلومة الصحيحة');
console.log('AI verification tests: PASS');
