const response = require('../systems/response');
const { t } = require('../lib/i18n');
require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const { assertPublicHttpUrl } = require('../lib/url-security');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const { uploadImage } = require('../lib/uploadImage');

const MODEL_DIR = path.join(process.cwd(), 'models');
const MODEL_PATH = path.join(MODEL_DIR, 'realesr-general-x4v3.onnx');
const MODEL_URL = 'https://huggingface.co/CoderViking/realesr-general-x4v3-onnx/resolve/c6a971706797c7502945a2b4c4274fce4900d4ab/realesr-general-x4v3.onnx?download=true';
const MODEL_SHA256 = '1940a93ee08283a0a7286183186357b1688fe9fa8ede74604b424586aaddf112';
const MODEL_BYTES = 4866417;
const TILE = 384;
const OVERLAP = 16;
let ortPromise = null;
let sessionPromise = null;

async function getQuotedOrOwnImageUrl(sock, message) {
    const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (quoted?.imageMessage) {
        const stream = await downloadContentFromMessage(quoted.imageMessage, 'image');
        const chunks = [];
        for await (const chunk of stream) chunks.push(chunk);
        return await uploadImage(Buffer.concat(chunks));
    }
    if (message.message?.imageMessage) {
        const stream = await downloadContentFromMessage(message.message.imageMessage, 'image');
        const chunks = [];
        for await (const chunk of stream) chunks.push(chunk);
        return await uploadImage(Buffer.concat(chunks));
    }
    return null;
}

async function getOrt() {
    if (!ortPromise) ortPromise = import('onnxruntime-node');
    return ortPromise;
}

async function ensureModel() {
    await fsp.mkdir(MODEL_DIR, { recursive: true });
    try {
        const stat = await fsp.stat(MODEL_PATH);
        if (stat.size === MODEL_BYTES) {
            const hash = await sha256File(MODEL_PATH);
            if (hash === MODEL_SHA256) return;
        }
    } catch (_) {}

    const tmp = `${MODEL_PATH}.part`;
    const res = await axios.get(MODEL_URL, {
        responseType: 'stream',
        timeout: 120000,
        maxContentLength: 10 * 1024 * 1024,
        headers: { 'User-Agent': 'LeoBot/1.37.6', Accept: 'application/octet-stream' },
    });
    const hash = crypto.createHash('sha256');
    let size = 0;
    await new Promise((resolve, reject) => {
        const out = fs.createWriteStream(tmp);
        res.data.on('data', chunk => { size += chunk.length; hash.update(chunk); });
        res.data.on('error', reject);
        out.on('error', reject);
        out.on('finish', resolve);
        res.data.pipe(out);
    });
    const digest = hash.digest('hex');
    if (size !== MODEL_BYTES || digest !== MODEL_SHA256) {
        await fsp.rm(tmp, { force: true });
        throw new Error('Invalid Real-ESRGAN model download');
    }
    await fsp.rename(tmp, MODEL_PATH);
}

async function sha256File(file) {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(file);
    for await (const chunk of stream) hash.update(chunk);
    return hash.digest('hex');
}

async function getSession() {
    if (!sessionPromise) {
        sessionPromise = (async () => {
            await ensureModel();
            const ort = await getOrt();
            return ort.InferenceSession.create(MODEL_PATH, {
                executionProviders: ['cpu'],
                graphOptimizationLevel: 'all',
            });
        })().catch(err => { sessionPromise = null; throw err; });
    }
    return sessionPromise;
}

async function tensorFromImage(buffer, width, height) {
    const { data } = await sharp(buffer)
        .resize(width, height, { fit: 'fill' })
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
    const plane = width * height;
    const input = new Float32Array(plane * 3);
    for (let i = 0; i < plane; i++) {
        input[i] = data[i * 3] / 255;
        input[plane + i] = data[i * 3 + 1] / 255;
        input[plane * 2 + i] = data[i * 3 + 2] / 255;
    }
    const ort = await getOrt();
    return new ort.Tensor('float32', input, [1, 3, height, width]);
}

async function outputToPng(output, width, height) {
    const data = output.data;
    const plane = width * height;
    const raw = Buffer.allocUnsafe(plane * 3);
    for (let i = 0; i < plane; i++) {
        raw[i * 3] = Math.max(0, Math.min(255, Math.round(data[i] * 255)));
        raw[i * 3 + 1] = Math.max(0, Math.min(255, Math.round(data[plane + i] * 255)));
        raw[i * 3 + 2] = Math.max(0, Math.min(255, Math.round(data[plane * 2 + i] * 255)));
    }
    return sharp(raw, { raw: { width, height, channels: 3 } }).png({ compressionLevel: 6 }).toBuffer();
}

async function upscaleLocalRealEsrgan(source) {
    const session = await getSession();
    const meta = await sharp(source).metadata();
    if (!meta.width || !meta.height) throw new Error('Invalid source image');

    // Keep WhatsApp workloads bounded on Railway CPU while preserving AI 4x detail.
    const normalized = await sharp(source, { failOn: 'none' })
        .rotate()
        .removeAlpha()
        .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true, kernel: sharp.kernel.lanczos3 })
        .png()
        .toBuffer();
    const nm = await sharp(normalized).metadata();
    const W = nm.width, H = nm.height;
    const outW = W * 4, outH = H * 4;
    const canvas = sharp({ create: { width: outW, height: outH, channels: 3, background: { r: 0, g: 0, b: 0 } } });
    const composites = [];

    for (let y = 0; y < H; y += TILE - OVERLAP * 2) {
        for (let x = 0; x < W; x += TILE - OVERLAP * 2) {
            const coreLeft = x;
            const coreTop = y;
            const coreRight = Math.min(x + TILE - OVERLAP * 2, W);
            const coreBottom = Math.min(y + TILE - OVERLAP * 2, H);
            const left = Math.max(0, coreLeft - OVERLAP);
            const top = Math.max(0, coreTop - OVERLAP);
            const right = Math.min(W, coreRight + OVERLAP);
            const bottom = Math.min(H, coreBottom + OVERLAP);
            const tw = right - left, th = bottom - top;
            const tile = await sharp(normalized).extract({ left, top, width: tw, height: th }).png().toBuffer();
            const input = await tensorFromImage(tile, tw, th);
            const outputs = await session.run({ [session.inputNames[0]]: input });
            const out = outputs[session.outputNames[0]];
            const tilePng = await outputToPng(out, tw * 4, th * 4);
            const cropLeft = (coreLeft - left) * 4;
            const cropTop = (coreTop - top) * 4;
            const cropWidth = (coreRight - coreLeft) * 4;
            const cropHeight = (coreBottom - coreTop) * 4;
            const cropped = await sharp(tilePng).extract({ left: cropLeft, top: cropTop, width: cropWidth, height: cropHeight }).png().toBuffer();
            composites.push({ input: cropped, left: coreLeft * 4, top: coreTop * 4 });
        }
    }
    return canvas.composite(composites).jpeg({ quality: 93, chromaSubsampling: '4:4:4', mozjpeg: true }).toBuffer();
}

async function reminiCommand(sock, chatId, message, args) {
    try {
        let imageUrl = null;
        if (args.length > 0) {
            const url = args.join(' ');
            if (isValidUrl(url)) imageUrl = url;
            else return response.text(sock, chatId, t('media.remini.invalidUrl'), message);
        } else {
            imageUrl = await getQuotedOrOwnImageUrl(sock, message);
            if (!imageUrl) return response.text(sock, chatId, t('media.remini.usage'), message);
        }
        await assertPublicHttpUrl(imageUrl);
        const sourceResponse = await axios.get(imageUrl, {
            responseType: 'arraybuffer', timeout: 30000, maxContentLength: 25 * 1024 * 1024,
            headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'image/*' },
        });
        const enhanced = await upscaleLocalRealEsrgan(Buffer.from(sourceResponse.data));
        await response.media(sock, chatId, { image: enhanced, caption: t('media.remini.success') }, message);
    } catch (error) {
        console.error('Image Enhancement Error:', error.message);
        let errorMessage = '❌ تعذر تحسين الصورة حاليًا.';
        if (error.code === 'ECONNABORTED') errorMessage = '⏳ انتهت مهلة معالجة الصورة.';
        else if (error.message.includes('Invalid source') || error.message.includes('Invalid Real-ESRGAN')) errorMessage = '❌ تعذر معالجة الصورة. جرّب صورة أخرى.';
        else if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) errorMessage = '🌐 تعذر تجهيز خدمة تحسين الصور حاليًا.';
        await response.text(sock, chatId, errorMessage, message);
    }
}

function isValidUrl(string) {
    try { new URL(string); return true; } catch (_) { return false; }
}

module.exports = { reminiCommand };
