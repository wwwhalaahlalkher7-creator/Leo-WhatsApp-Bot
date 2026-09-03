'use strict';

function detectResearchNeed(prompt, options = {}) {
  if (options.verify === true || options.research === true) return 'required';
  if (options.verify === false || options.research === false) return 'none';
  const text = String(prompt || '').trim();
  if (!text) return 'none';

  // Use web grounding only when it materially improves factual reliability.
  const current = /(اليوم|حالي(?:ا|اً)|الآن|اخر|آخر|حديث|حديثة|الجديد|جديد|هذا الأسبوع|هذا الشهر|2026|موعد|متى يبدأ|متى ينتهي|من فاز|نتيجة|خبر|أخبار|السعر|الطقس|ترند)/i.test(text);
  const verify = /(هل صحيح|هل هذا صحيح|تحقق|تأكد|تاكد|verify|fact check|صحيح أم خطأ|صحيح ولا لا|هل فعلاً|هل فعلا)/i.test(text);
  const source = /(المصدر|مصدر|مصادر|دليل|مرجع|رابط رسمي)/i.test(text);
  if (verify || current || source) return 'required';
  return 'none';
}

function formatSources(sources = []) {
  const unique = [];
  const seen = new Set();
  for (const source of sources) {
    const uri = String(source?.uri || '').trim();
    const title = String(source?.title || '').trim();
    if (!uri || seen.has(uri)) continue;
    seen.add(uri);
    unique.push({ title: title || uri, uri });
    if (unique.length >= 4) break;
  }
  if (!unique.length) return '';
  return '\n\nالمصادر:\n' + unique.map((s, i) => `${i + 1}. ${s.title}\n${s.uri}`).join('\n');
}

function extractGroundingSources(data) {
  const chunks = data?.groundingMetadata?.groundingChunks || data?.groundingMetadata?.grounding_chunks || [];
  return chunks.map(chunk => chunk?.web || chunk?.retrievedContext || chunk?.retrieved_context || chunk)
    .map(item => ({ uri: item?.uri || item?.url, title: item?.title || item?.name }))
    .filter(item => item.uri);
}

module.exports = { detectResearchNeed, formatSources, extractGroundingSources };
