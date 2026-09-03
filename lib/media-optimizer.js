/**
 * Leo Bot - WhatsApp media compatibility + compression layer.
 *
 * Normalizes audio/video before sending so WhatsApp receives:
 * - Audio: MP3 (MPEG Layer III), mono/stereo as appropriate
 * - Video: MP4 (H.264 + AAC), faststart enabled
 *
 * The input can be a URL, local path, or Buffer. FFmpeg is used because
 * file extensions/MIME labels alone do not convert incompatible codecs.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const axios = require('axios');
const { assertPublicHttpUrl } = require('./url-security');

const TMP_DIR = path.join(process.cwd(), 'tmp', 'media-optimized');
fs.mkdirSync(TMP_DIR, { recursive: true });

function uniquePath(ext) {
  return path.join(TMP_DIR, `wa-${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`);
}

function runFfmpeg(input, args, output) {
  return new Promise((resolve, reject) => {
    const ff = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...input, ...args, output], {
      stdio: ['pipe', 'ignore', 'pipe']
    });
    let stderr = '';
    ff.stderr.on('data', d => { stderr += d.toString(); });
    ff.on('error', err => reject(new Error(`FFmpeg unavailable: ${err.message}`)));
    ff.on('close', code => {
      if (code === 0) return resolve(output);
      reject(new Error(`FFmpeg failed (${code}): ${stderr.slice(-2000)}`));
    });
  });
}

async function materialize(input, ext) {
  if (Buffer.isBuffer(input)) {
    const p = uniquePath(ext);
    await fs.promises.writeFile(p, input);
    return { path: p, cleanup: true };
  }

  if (typeof input === 'string' && /^https?:\/\//i.test(input)) {
    await assertPublicHttpUrl(input);
    const p = uniquePath(ext);
    const response = await axios.get(input, {
      responseType: 'stream',
      timeout: 120000,
      maxRedirects: 5,
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: '*/*' }
    });
    await new Promise((resolve, reject) => {
      const out = fs.createWriteStream(p);
      response.data.pipe(out);
      response.data.on('error', reject);
      out.on('finish', resolve);
      out.on('error', reject);
    });
    return { path: p, cleanup: true };
  }

  if (typeof input === 'string') return { path: input, cleanup: false };
  throw new Error('Unsupported media input');
}

async function optimizeAudio(input, options = {}) {
  const src = await materialize(input, 'input');
  const output = uniquePath('mp3');
  try {
    const bitrate = options.bitrate || '96k';
    const mono = options.mono !== false;
    await runFfmpeg(
      ['-i', src.path],
      [
        '-vn',
        '-map_metadata', '-1',
        '-c:a', 'libmp3lame',
        '-b:a', bitrate,
        '-ar', '44100',
        ...(mono ? ['-ac', '1'] : ['-ac', '2']),
        '-id3v2_version', '3'
      ],
      output
    );
    return output;
  } finally {
    if (src.cleanup) fs.promises.unlink(src.path).catch(() => {});
  }
}

async function optimizeVideo(input, options = {}) {
  const src = await materialize(input, 'input');
  const output = uniquePath('mp4');
  try {
    const crf = String(options.crf ?? 32);
    const maxWidth = Number(options.maxWidth || 640);
    const audioBitrate = options.audioBitrate || '64k';

    // Scale down only when wider than maxWidth; preserve aspect ratio.
    const vf = `scale='min(${maxWidth},iw)':-2:flags=lanczos`;

    await runFfmpeg(
      ['-i', src.path],
      [
        '-map', '0:v:0',
        '-map', '0:a:0?',
        '-vf', vf,
        '-c:v', 'libx264',
        '-preset', options.preset || 'medium',
        '-crf', crf,
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-b:a', audioBitrate,
        '-ac', '2',
        '-ar', '44100',
        '-movflags', '+faststart',
        '-map_metadata', '-1'
      ],
      output
    );
    return output;
  } finally {
    if (src.cleanup) fs.promises.unlink(src.path).catch(() => {});
  }
}

async function withOptimizedMedia(input, type, options = {}) {
  return type === 'audio'
    ? optimizeAudio(input, options)
    : optimizeVideo(input, options);
}

function cleanup(filePath) {
  if (filePath) fs.promises.unlink(filePath).catch(() => {});
}

module.exports = { optimizeAudio, optimizeVideo, withOptimizedMedia, cleanup };
