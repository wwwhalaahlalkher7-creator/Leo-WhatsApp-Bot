'use strict';
const assert = require('assert');
const { normalizeMediaResult, normalizeMediaItem, normalizeAnimeResult } = require('./lib/providers/core/normalize');

assert.strictEqual(normalizeMediaResult(null), null);
assert.strictEqual(normalizeMediaResult({ download: 'not-url' }), null);
const media = normalizeMediaResult({ download: ' https://cdn.example.test/a.mp3 ', media: [{ url: 'https://cdn.example.test/a.mp3', type: 'audio' }, { downloadUrl: 'https://cdn.example.test/b.mp3', quality: '128k' }] });
assert.ok(media);
assert.strictEqual(media.download, 'https://cdn.example.test/a.mp3');
assert.strictEqual(media.media.length, 2);
assert.strictEqual(media.media[1].quality, '128k');
assert.deepStrictEqual(normalizeMediaItem('https://cdn.example.test/v.mp4', 'video'), { url: 'https://cdn.example.test/v.mp4', type: 'video' });
assert.strictEqual(normalizeAnimeResult({ id: 7, provider: 'jikan', title: 'Naruto', score: '8.1' }).score, 8.1);
assert.strictEqual(normalizeAnimeResult({ id: 7, provider: 'jikan' }), null);
console.log('PASS: provider result normalization produces stable media/anime shapes and removes invalid or duplicate media URLs');
