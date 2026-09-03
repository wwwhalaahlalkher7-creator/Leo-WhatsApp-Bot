'use strict';

/**
 * Leo AI capability layer. Commands should depend on capabilities rather than
 * knowing which concrete provider is behind them. Provider selection/fallback
 * remains inside systems/provider/ai -> lib/providers/ai.
 */
const provider = require('../provider/ai');

const capabilities = Object.freeze({
  chat: (...args) => provider.chat(...args),
  // Multimodal/vision requests use the same chat capability with image content.
  vision: (...args) => provider.chat(...args),
  imageGeneration: (...args) => provider.generateImage(...args),
  videoGeneration: (...args) => provider.generateVideo(...args),
  documentExtraction: (...args) => provider.extractText(...args),
  audioTranscription: (...args) => provider.transcribeAudio(...args),
  audioTranslation: (...args) => provider.translateAudio(...args),
  translation: (...args) => provider.translateText(...args),
  speechSynthesis: (...args) => provider.synthesizeSpeech(...args),
});

function has(capability) {
  return typeof capabilities[capability] === 'function';
}

function list() {
  return Object.keys(capabilities);
}

module.exports = Object.freeze({ ...capabilities, has, list });
