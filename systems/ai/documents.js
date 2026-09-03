'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const pdf = require('../../lib/pdf');
const ai = require('./index');

const ENGINE = path.join(process.cwd(), 'scripts', 'pdf_engine.py');
const MAX_CHARS = 50000;
const MAX_PAGES = 80;
const TIMEOUT_MS = 180000;

function runEngine(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('python3', [ENGINE, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('انتهت مهلة استخراج محتوى المستند.')); }, TIMEOUT_MS);
    child.stdout.on('data', d => { out += d.toString(); });
    child.stderr.on('data', d => { err += d.toString(); });
    child.on('error', e => { clearTimeout(timer); reject(e); });
    child.on('close', code => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(err.trim() || out.trim() || `Document engine exited with code ${code}`));
      try { resolve(JSON.parse(out)); } catch { reject(new Error('تعذر قراءة نتيجة استخراج المستند.')); }
    });
  });
}

function safeName(name = 'document.pdf') {
  return String(name).replace(/[^\w\-.\u0600-\u06ff ]+/g, '_').slice(0, 100) || 'document.pdf';
}

async function extractPdfBuffer(buffer, name = 'document.pdf') {
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw new Error('المستند فارغ.');
  if (buffer.length > pdf.MAX_BYTES) throw new Error('المستند أكبر من الحد المسموح.');
  const dir = pdf.makeJobDir();
  const ext = pdf.safeExt(name, 'application/pdf') || 'pdf';
  const input = path.join(dir, `input-${crypto.randomBytes(4).toString('hex')}.${ext}`);
  fs.writeFileSync(input, buffer, { mode: 0o600 });
  try {
    let source = input;
    const resultExt = pdf.safeExt(name, 'application/pdf');
    if (['doc','docx','ppt','pptx','xls','xlsx'].includes(resultExt)) {
      const converted = await runEngine(['--operation', 'office-to-pdf', '--input', input, '--output-dir', dir, '--max-pages', String(MAX_PAGES)]);
      source = converted.output;
    } else if (!['pdf'].includes(resultExt)) {
      return { type: 'image', page_count: 1, text: '', pages: [], source: input, dir };
    }
    const extracted = await runEngine(['--operation', 'extract-text', '--input', source, '--output-dir', dir, '--max-pages', String(MAX_PAGES)]);
    return { type: 'document', source, dir, ...extracted };
  } catch (error) {
    pdf.cleanup(dir);
    throw error;
  }
}

function clipText(text, max = MAX_CHARS) {
  const value = String(text || '').trim();
  if (value.length <= max) return value;
  return `${value.slice(0, max)}\n\n[تم اختصار النص بسبب حد السياق]`;
}

async function analyze({ buffer, name, mime, question = '' , chatId = '', userId = '' }) {
  const extracted = await extractPdfBuffer(buffer, name);
  if (extracted.type === 'image') {
    return { ...extracted, answer: 'هذا الملف صورة وليس مستندًا نصيًا. استخدم أمر `.ليو` مع الصورة لتحليل محتواها بصريًا.' };
  }
  const task = String(question || '').trim() || 'لخّص هذا المستند بوضوح، واستخرج أهم النقاط والقرارات والأرقام والتواريخ. إذا كان المحتوى غير كافٍ أو غير واضح فاذكر ذلك صراحة.';
  const fullText = String(extracted.text || '').trim();
  if (!fullText) {
    return { ...extracted, answer: `لم أجد نصًا قابلًا للاستخراج من المستند. عدد الصفحات: ${extracted.page_count}. إذا كان الملف عبارة عن صور ممسوحة ضوئيًا، أرسل الصفحات كصور لتحليلها بصريًا.` };
  }

  // Public fallback providers use URL-based APIs; sending 50k+ chars in one request
  // is unreliable. Analyze bounded chunks first, then synthesize the compact findings.
  const CHUNK = 7000;
  const chunks = [];
  for (let i = 0; i < fullText.length; i += CHUNK) chunks.push(fullText.slice(i, i + CHUNK));
  const findings = [];
  const baseSystem = 'أنت محلل مستندات داخل LeoBot. اعتمد فقط على النص المرفق. لا تخترع معلومات. اذكر أرقام الصفحات الموجودة في النص عند الإمكان. أجب بالعربية ما لم يطلب المستخدم لغة أخرى.';
  try {
    for (let i = 0; i < chunks.length; i++) {
      const chunkPrompt = `${task}\n\nحلّل الجزء ${i + 1} من ${chunks.length} فقط، واستخرج المعلومات المفيدة التي ستحتاجها الإجابة النهائية. لا تقل إنك لا ترى بقية المستند.\n\nالنص:\n${chunks[i]}`;
      try {
        const result = await ai.chat(chunkPrompt, {
          chatId, userId,
          context: '',
          systemPrompt: baseSystem,
        });
        if (result?.text) findings.push(`الجزء ${i + 1}:\n${result.text}`);
      } catch (error) {
        console.warn(`[DOCUMENT] chunk ${i + 1}/${chunks.length} failed:`, error?.message || error);
      }
    }

    if (!findings.length) {
      // Deterministic fallback: never turn a readable PDF into a generic apology.
      const words = fullText.split(/\s+/).filter(Boolean);
      const numbers = [...new Set(fullText.match(/\b\d[\d,.%-]*\b/g) || [])].slice(0, 30);
      const headings = fullText.split(/\n+/).map(x => x.trim()).filter(x => x && x.length <= 140 && !/[.!؟]$/.test(x)).slice(0, 12);
      return {
        ...extracted,
        answer: `📄 تعذر الوصول إلى مزود الذكاء الاصطناعي حاليًا، لكن تمت قراءة المستند بنجاح.\n\n• الصفحات: ${extracted.page_count}\n• الكلمات المستخرجة: ${words.length}\n• أبرز العناوين/الأسطر: ${headings.length ? headings.join(' | ') : 'لم تُكتشف عناوين واضحة'}\n• أرقام ظاهرة: ${numbers.length ? numbers.join(', ') : 'لا توجد أرقام واضحة'}\n\nالنص المستخرج محفوظ داخل النظام ويمكن إعادة التحليل لاحقًا.`
      };
    }

    const synthesisContext = clipText(findings.join('\n\n'), Math.min(MAX_CHARS, 26000));
    const final = await ai.chat(task, {
      chatId, userId,
      context: synthesisContext,
      systemPrompt: `${baseSystem}\nهذه ملاحظات أولية من أجزاء المستند. اجمعها في إجابة واحدة متماسكة، ولا تضف معلومة غير موجودة فيها. إذا تعارضت ملاحظتان، اذكر عدم اليقين بدل التخمين.`
    });
    return { ...extracted, answer: final.text, provider: final.provider };
  } finally {
    pdf.cleanup(extracted.dir);
  }
}
module.exports = { extractPdfBuffer, analyze, clipText, MAX_CHARS, MAX_PAGES };
