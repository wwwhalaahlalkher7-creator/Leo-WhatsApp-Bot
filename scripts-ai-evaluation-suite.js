'use strict';
const assert = require('assert');
const response = require('./systems/ai/response');
const reliability = require('./systems/ai/reliability');
const persona = require('./systems/ai/persona');
const research = require('./systems/ai/research');
const context = require('./systems/ai/context');

const tests = [];
function test(name, fn) { tests.push([name, fn]); }

test('legacy prefix: جواب', () => assert.strictEqual(response.cleanAiPrefix('جواب\n\nالإجابة الفعلية'), 'الإجابة الفعلية'));
test('legacy prefix: ؟', () => assert.strictEqual(response.cleanAiPrefix('؟\n\nالإجابة الفعلية'), 'الإجابة الفعلية'));
test('legacy prefix: normal question', () => assert.strictEqual(response.cleanAiPrefix('هل هذا صحيح؟\nنعم.'), 'هل هذا صحيح؟\nنعم.'));
test('duplicate lines removed', () => assert.strictEqual(response.dedupeResponse('سطر مهم\nسطر مهم\nسطر آخر'), 'سطر مهم\nسطر آخر'));
test('previous duplicate detected', () => assert.strictEqual(reliability.isLikelyDuplicateOfPrevious('هذه إجابة سابقة مفيدة', 'المستخدم: سؤال\nليو: هذه إجابة سابقة مفيدة'), true));
test('different answer accepted', () => assert.strictEqual(reliability.isLikelyDuplicateOfPrevious('هذه إجابة جديدة مختلفة تمامًا', 'المستخدم: سؤال\nليو: هذه إجابة سابقة مفيدة'), false));
test('friend mode', () => assert.strictEqual(persona.detectMode('أنا طفشان، ونسني'), 'friend'));
test('assistant mode', () => assert.strictEqual(persona.detectMode('اشرح لي recursion'), 'assistant'));
test('current info requires research', () => assert.strictEqual(research.detectResearchNeed('ما آخر الأخبار اليوم؟'), 'required'));
test('source request requires research', () => assert.strictEqual(research.detectResearchNeed('أعطني المصدر الرسمي'), 'required'));
test('stable explanation does not require research', () => assert.strictEqual(research.detectResearchNeed('اشرح لي مفهوم recursion'), 'none'));
test('source dedupe', () => {
  const out = research.formatSources([{uri:'https://x/a',title:'A'},{uri:'https://x/a',title:'A duplicate'},{uri:'https://x/b',title:'B'}]);
  assert.strictEqual((out.match(/https:\/\/x\/a/g)||[]).length,1);
  assert(out.includes('B'));
});
test('context isolation', () => {
  const a = context.keyFor('chat-a','user');
  const b = context.keyFor('chat-b','user');
  context.clear('chat-a','user'); context.clear('chat-b','user');
  context.addUser('chat-a','user','A');
  assert(context.format('chat-a','user').includes('A'));
  assert(!context.format('chat-b','user').includes('A'));
  context.clear('chat-a','user'); context.clear('chat-b','user');
});

test('persona includes truthfulness rules', () => {
  const p = persona.build({mode:'assistant'});
  assert(p.includes('لا تخترع'));
  assert(p.includes('صحح الافتراض'));
});

let passed = 0;
for (const [name, fn] of tests) {
  try { fn(); passed++; console.log(`✅ ${name}`); }
  catch (e) { console.error(`❌ ${name}: ${e.message}`); process.exitCode = 1; }
}
console.log(`\nAI Evaluation Suite: ${passed}/${tests.length} passed`);
if (passed !== tests.length) process.exitCode = 1;
