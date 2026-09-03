'use strict';

const provider = require('../provider/ai');
const context = require('./context');
const persona = require('./persona');
const response = require('./response');
const reliability = require('./reliability');
const research = require('./research');
const capabilities = require('./capabilities');

// Prevent identical concurrent requests from reaching providers twice.
const inFlight = new Map();
const IN_FLIGHT_TTL_MS = 90_000;
function requestKey(prompt, options = {}) {
  return [options.chatId || '', options.userId || '', options.mediaKey || '', String(prompt || '').trim()].join('\x1f');
}
function cleanupInFlight() {
  const now = Date.now();
  for (const [key, item] of inFlight) {
    if (now - item.startedAt > IN_FLIGHT_TTL_MS) inFlight.delete(key);
  }
}

async function chat(prompt, options = {}) {
  cleanupInFlight();
  const key = requestKey(prompt, options);
  if (key && inFlight.has(key)) return inFlight.get(key).promise;
  const work = (async () => {
  const mode = persona.detectMode(prompt, options);
  const researchMode = research.detectResearchNeed(prompt, options);
  const systemPrompt = `${persona.build({ mode })}\n${options.systemPrompt || ''}`.trim();
  const contextText = options.context || '';
  const avoidResponse = reliability.lastAssistantMessage(contextText);
  const reliabilityInstruction = reliability.buildReliabilityInstruction({ avoidResponse });
  const requestOptions = {
    ...options,
    systemPrompt: `${systemPrompt}\n${reliabilityInstruction}`.trim(),
    mode,
    context: contextText,
    grounding: researchMode === 'required',
  };

  let result = await provider.chat(prompt, requestOptions);
  if (researchMode === 'required' && !result.grounded) {
    throw new Error('لم يتمكن ليو من التحقق من هذه المعلومة عبر مصدر خارجي موثوق.');
  }
  let cleaned = response.dedupeResponse(result?.text);
  if (!cleaned) throw new Error('AI provider returned an empty usable response');

  // One bounded retry prevents accidental repetition without creating an API retry loop.
  if (reliability.isLikelyDuplicateOfPrevious(cleaned, contextText)) {
    result = await provider.chat(prompt, {
      ...requestOptions,
      excludeProviders: [result?.provider].filter(Boolean),
      systemPrompt: `${requestOptions.systemPrompt}\nأعد الإجابة من زاوية مختلفة ومفيدة. لا تكرر الإجابة السابقة أو جملها، ولا تضف معلومات غير مؤكدة.`.trim(),
      avoidResponse: cleaned,
    });
    cleaned = response.dedupeResponse(result?.text);
  }
  if (!cleaned) throw new Error('AI provider returned an empty usable response');
  const sourceText = result.grounded ? research.formatSources(result.sources) : '';
  return { ...result, text: `${cleaned}${sourceText}`, mode, research: researchMode };
  })();
  if (key) {
    inFlight.set(key, { promise: work, startedAt: Date.now() });
    work.finally(() => inFlight.delete(key)).catch(() => {});
  }
  return work;
}

module.exports = { chat, context, persona, response, reliability, research, capabilities, requestKey, inFlight };
