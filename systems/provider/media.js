'use strict';

function impl() { return require('../../lib/providers/downloaders'); }

module.exports = Object.freeze({
  name: 'media',
  youtubeAudio: (...args) => impl().youtubeAudio(...args),
  youtubeVideo: (...args) => impl().youtubeVideo(...args),
  tiktok: (...args) => impl().tiktok(...args),
  instagram: (...args) => impl().instagram(...args),
  facebook: (...args) => impl().facebook(...args),
  fetchMedia: (...args) => impl().fetchMedia(...args),
});
