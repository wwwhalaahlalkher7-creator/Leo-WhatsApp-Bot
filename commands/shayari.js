const { t } = require('../lib/i18n');

const QAFIYAH_RANDOM_URL = 'https://api.qafiyah.com/v1/poems/random?option=lines';

function cleanText(value) {
    if (typeof value !== 'string') return '';
    return value.replace(/\r\n/g, '\n').replace(/[ \t]+\n/g, '\n').trim();
}

function extractPoetry(payload) {
    if (typeof payload === 'string') return cleanText(payload);
    if (!payload || typeof payload !== 'object') return '';

    const candidates = [
        payload.text,
        payload.content,
        payload.poem,
        payload.body,
        payload.result,
        payload.data?.text,
        payload.data?.content,
        payload.data?.poem,
        payload.data?.body,
        payload.data?.result,
        payload.data?.poetry,
        payload.poetry,
    ];

    for (const candidate of candidates) {
        if (typeof candidate === 'string' && cleanText(candidate)) return cleanText(candidate);
        if (candidate && typeof candidate === 'object') {
            const nested = extractPoetry(candidate);
            if (nested) return nested;
        }
    }

    const lines = payload.lines || payload.data?.lines || payload.verses || payload.data?.verses;
    if (Array.isArray(lines)) {
        const text = lines
            .flatMap(line => Array.isArray(line) ? line : [line])
            .map(line => typeof line === 'string' ? line : (line?.text || line?.content || ''))
            .map(cleanText)
            .filter(Boolean)
            .join('\n');
        if (text) return text;
    }

    if (Array.isArray(payload.data)) {
        for (const item of payload.data) {
            const nested = extractPoetry(item);
            if (nested) return nested;
        }
    }

    return '';
}

async function shayariCommand(sock, chatId, message) {
    try {
        const apiResponse = await fetch(QAFIYAH_RANDOM_URL, {
            headers: { Accept: 'application/json, text/plain;q=0.9, */*' },
            signal: AbortSignal.timeout(15000),
        });

        if (!apiResponse.ok) {
            throw new Error(`Qafiyah HTTP ${apiResponse.status}`);
        }

        const raw = await apiResponse.text();
        let poetry = '';
        try {
            poetry = extractPoetry(JSON.parse(raw));
        } catch (_) {
            poetry = cleanText(raw);
        }

        if (!poetry) throw new Error('Qafiyah returned no poetry');

        await sock.sendMessage(chatId, {
            text: `✍️ *شعر اليوم*\n\n${poetry}`,
            buttons: [
                { buttonId: '.شعر', buttonText: { displayText: 'شعر 🪄' }, type: 1 },
            ],
            headerType: 1,
        }, { quoted: message });
    } catch (error) {
        console.error('[SHAYARI] Poetry service unavailable:', error?.message || error);
        await sock.sendMessage(chatId, { text: t('fun.shayari') }, { quoted: message });
    }
}

module.exports = { shayariCommand };
