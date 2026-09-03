'use strict';

const { similarity } = require('./response');

function lastAssistantMessage(context) {
  const lines = String(context || '').split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    if (/^ليو:\s*/u.test(lines[i])) return lines[i].replace(/^ليو:\s*/u, '').trim();
  }
  return '';
}

function isLikelyDuplicateOfPrevious(reply, context, threshold = 0.88) {
  const previous = lastAssistantMessage(context);
  return Boolean(previous && reply && similarity(previous, reply) >= threshold);
}

function buildReliabilityInstruction(options = {}) {
  const avoid = String(options.avoidResponse || '').trim();
  return `
قواعد الموثوقية:
- لا تملأ فراغ المعرفة بالتخمين. إذا لم تعرف أو لم تكن متأكدًا، اذكر ذلك بوضوح.
- في الأسماء والأرقام والتواريخ والأحداث والادعاءات الواقعية، لا تخترع تفاصيل لإكمال الإجابة.
- إذا كانت المعلومة قابلة للتغير مع الزمن، نبّه المستخدم إلى أن التحقق الحديث قد يكون مطلوبًا ما لم تكن لديك أداة تحقق فعلية.
- إذا طلب المستخدم رأيًا أو نصيحة، ميّز الرأي عن الحقيقة.
- لا تكرر إجابة سابقة لمجرد استمرار المحادثة؛ أضف معلومة جديدة أو أعد صياغة مفيدة فعلًا.
${avoid ? `- هذه إجابة سابقة قريبة من الطلب. لا تكررها نصيًا أو معنويًا دون إضافة قيمة جديدة:\n${avoid}` : ''}`.trim();
}

module.exports = { lastAssistantMessage, isLikelyDuplicateOfPrevious, buildReliabilityInstruction };
