'use strict';

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const MAX_INPUT_BYTES = 512 * 1024 * 1024;
const MAX_CLIP_SECONDS = 180;
const DEFAULT_CLIP_SECONDS = 30;

function tempDir() {
  const dir = path.join(process.cwd(), 'temp', 'video-jobs', crypto.randomBytes(8).toString('hex'));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let settled = false;

    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      fn(value);
    };

    const timer = setTimeout(() => {
      try { child.kill('SIGKILL'); } catch {}
      finish(reject, new Error(`${command} timed out`));
    }, Math.max(1000, Number(options.timeoutMs) || 120000));

    child.stdout.on('data', d => { stdout += d.toString(); });
    child.stderr.on('data', d => { stderr += d.toString(); });
    child.on('error', error => {
      clearTimeout(timer);
      finish(reject, error);
    });
    child.on('close', code => {
      clearTimeout(timer);
      if (code === 0) return finish(resolve, stdout.trim());
      const error = new Error(stderr.trim() || `${command} exited with code ${code}`);
      error.code = `MEDIA_${command.toUpperCase()}_FAILED`;
      finish(reject, error);
    });

    if (options.signal) {
      if (options.signal.aborted) {
        try { child.kill('SIGKILL'); } catch {}
      } else {
        options.signal.addEventListener('abort', () => {
          try { child.kill('SIGKILL'); } catch {}
        }, { once: true });
      }
    }
  });
}

async function probe(input, options = {}) {
  const stat = await fsp.stat(input);
  if (!stat.isFile() || stat.size <= 0) throw new Error('الفيديو فارغ.');
  if (stat.size > MAX_INPUT_BYTES) throw new Error('الفيديو يتجاوز الحد المسموح للمعالجة.');

  const output = await run('ffprobe', [
    '-v', 'error',
    '-print_format', 'json',
    '-show_format',
    '-show_streams',
    input,
  ], options);
  const data = JSON.parse(output || '{}');
  const video = (data.streams || []).find(x => x.codec_type === 'video');
  const duration = Number(data.format?.duration || video?.duration || 0);
  if (!video || !Number.isFinite(duration) || duration <= 0) throw new Error('تعذر قراءة معلومات الفيديو.');
  return {
    duration,
    width: Number(video.width || 0),
    height: Number(video.height || 0),
    codec: video.codec_name || null,
    fps: video.r_frame_rate || null,
    size: stat.size,
  };
}

function clampRange(start, duration, maxDuration = DEFAULT_CLIP_SECONDS) {
  const total = Math.max(0, Number(duration) || 0);
  const from = Math.max(0, Math.min(Number(start) || 0, Math.max(0, total - 0.1)));
  const length = Math.max(1, Math.min(Number(maxDuration) || DEFAULT_CLIP_SECONDS, MAX_CLIP_SECONDS, total - from));
  return { start: from, duration: length };
}

async function extractClip(input, options = {}) {
  const info = await probe(input, options);
  const range = clampRange(options.start, info.duration, options.duration);
  const dir = tempDir();
  const output = path.join(dir, 'clip.mp4');

  try {
    await run('ffmpeg', [
      '-hide_banner', '-loglevel', 'error',
      '-ss', String(range.start),
      '-i', input,
      '-t', String(range.duration),
      '-vf', 'scale=min(720\\,iw):-2',
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '30',
      '-c:a', 'aac',
      '-b:a', '80k',
      '-movflags', '+faststart',
      '-y', output,
    ], options);

    return { output, source: input, start: range.start, duration: range.duration, info };
  } catch (error) {
    await fsp.rm(dir, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}

async function optimize(input, options = {}) {
  const { optimizeVideo } = require('../../lib/media-optimizer');
  return optimizeVideo(input, {
    maxWidth: Math.min(720, Number(options.maxWidth) || 720),
    crf: 30,
    audioBitrate: '80k',
  });
}

async function cleanupJob(result) {
  if (!result) return;
  const candidates = [result.output].filter(Boolean);
  for (const file of candidates) {
    try { await fsp.rm(file, { force: true }); } catch {}
  }
  if (result.output) {
    try { await fsp.rm(path.dirname(result.output), { recursive: true, force: true }); } catch {}
  }
}

module.exports = {
  MAX_INPUT_BYTES,
  MAX_CLIP_SECONDS,
  DEFAULT_CLIP_SECONDS,
  probe,
  extractClip,
  optimize,
  cleanupJob,
};
