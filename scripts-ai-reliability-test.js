'use strict';
const assert = require('assert');
const aiResponse = require('./systems/ai/response');
const reliability = require('./systems/ai/reliability');

assert.strictEqual(aiResponse.cleanAiPrefix('جواب\n\nالإجابة الحقيقية'), 'الإجابة الحقيقية');
assert.strictEqual(aiResponse.cleanAiPrefix('?\n\nالإجابة الحقيقية'), 'الإجابة الحقيقية');
assert.strictEqual(aiResponse.cleanAiPrefix('؟\n\nالإجابة الحقيقية'), 'الإجابة الحقيقية');
assert.strictEqual(aiResponse.cleanAiPrefix('الإجابة:\n\nالإجابة الحقيقية'), 'الإجابة الحقيقية');

const context = 'المستخدم: سؤال سابق\nليو: هذه إجابة سابقة مفيدة';
assert.strictEqual(reliability.lastAssistantMessage(context), 'هذه إجابة سابقة مفيدة');
assert.strictEqual(reliability.isLikelyDuplicateOfPrevious('هذه إجابة سابقة مفيدة', context), true);
assert.strictEqual(reliability.isLikelyDuplicateOfPrevious('إجابة جديدة بمعلومات مختلفة تمامًا', context), false);

const instruction = reliability.buildReliabilityInstruction({ avoidResponse: 'هذه إجابة سابقة مفيدة' });
assert.ok(instruction.includes('لا تملأ فراغ المعرفة بالتخمين'));
assert.ok(instruction.includes('لا تكررها نصيًا أو معنويًا'));

console.log('✅ AI reliability test passed');
