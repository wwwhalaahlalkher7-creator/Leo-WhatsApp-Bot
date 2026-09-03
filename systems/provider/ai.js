'use strict';

function impl() { return require('../../lib/providers/ai'); }

module.exports = Object.freeze({
  name: 'ai',
  chat: (...args) => impl().chat(...args),
  generateImage: (...args) => impl().generateImage(...args),
  generateVideo: (...args) => impl().generateVideo(...args),
  extractText: (...args) => impl().extractText(...args),
  transcribeAudio: (...args) => impl().transcribeAudio(...args),
  translateAudio: (...args) => impl().translateAudio(...args),
  translateText: (...args) => impl().translateText(...args),
  synthesizeSpeech: (...args) => impl().synthesizeSpeech(...args),
});
