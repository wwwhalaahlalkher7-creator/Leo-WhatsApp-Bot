'use strict';

function impl() { return require('../../lib/providers/downloaders'); }

module.exports = Object.freeze({
  name: 'media',
  youtubeAudio: (...args) => impl().youtubeAudio(...args),
  youtubeVideo: (...args) => impl().youtubeVideo(...args),
  tiktok: (...args) => impl().tiktok(...args),
  instagram: (...args) => impl().instagram(...args),
  facebook: (...args) => impl().facebook(...args),
  allDl: (...args) => impl().allDl(...args),
  allDlOptions: (...args) => impl().allDlOptions(...args),
  mediaDownloadOptions: (...args) => impl().mediaDownloadOptions(...args),
  xTwitter: (...args) => impl().xTwitter(...args),
  socialUniversal: (...args) => impl().socialUniversal(...args),
  fetchMedia: (...args) => impl().fetchMedia(...args),
});
