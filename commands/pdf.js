const fs = require('fs');
const path = require('path');
const { register } = require('../lib/command-registry');
const { SessionManager } = require('../systems/session');
const interaction = require('../systems/interaction');
const {
  ROOT, MAX_BYTES, MAX_PAGES, mediaFromRawMessage, quotedMediaFromRawMessage,
  downloadMedia, processBuffer, processFilePath, processMultipleFilePaths, safeExt, cleanup, makeJobDir
} = require('../lib/pdf');
const documents = require('../systems/ai/documents');

const sessions = new SessionManager({ defaultTtl: 5 * 60 * 1000 });
const MULTI_IMAGE_MAX = 20;

function quotedId(message) {
  const root = message?.message || {};
  const containers = [root.extendedTextMessage, root.imageMessage, root.videoMessage, root.documentMessage, root.buttonsResponseMessage, root.listResponseMessage];
  for (const c of containers) if (c?.contextInfo?.stanzaId) return c.contextInfo.stanzaId;
  return null;
}
function clearSession(session, reason = 'closed') {
  if (!session) return;
  const dir = session.data?.dir;
  sessions.close(session, reason);
}
function createSession(chatId, senderId, data) {
  return sessions.create({ type: 'pdf', chatId, ownerId: senderId, data, onClose: session => { if (session?.data?.dir) cleanup(session.data.dir); } });
}
function menuText() {
  return `╭━━━〔 📄 أدوات PDF 〕━━━╮\n┃\n┃ ماذا تريد أن أفعل بهذا الملف؟\n┃\n┃ 1️⃣ PDF → Word\n┃ 2️⃣ PDF → PowerPoint\n┃ 3️⃣ PDF → Excel\n┃ 4️⃣ PDF → صورة\n┃ 5️⃣ ضغط PDF\n┃ 6️⃣ ترجمة PDF\n┃ 7️⃣ 🧠 تحليل ذكي بالذكاء الاصطناعي\n┃\n┃ ↩️ أرسل رقم العملية كرد\n┃ على هذه الرسالة.\n╰━━━━━━━━━━━━━━━━━━━━╯`;
}
function operationForNumber(n) {
  return ({1:'pdf-to-word',2:'pdf-to-ppt',3:'pdf-to-excel',4:'pdf-to-jpg',5:'compress-pdf',6:'translate-pdf'})[n];
}
function outputInfo(op) {
  return {
    'office-to-pdf': ['📄','PDF'], 'image-to-pdf':['📄','PDF'], 'pdf-to-word':['📝','Word'],
    'pdf-to-ppt':['📊','PowerPoint'], 'pdf-to-excel':['📊','Excel'], 'pdf-to-jpg':['🖼️','صورة'],
    'compress-pdf':['🗜️','PDF مضغوط'], 'translate-pdf':['🌐','PDF مترجم']
  }[op] || ['📄','ملف'];
}
function sourceFrom(message) { return mediaFromRawMessage(message) || quotedMediaFromRawMessage(message); }

async function sendResult(sock, chatId, message, result, operation) {
  const [icon, label] = outputInfo(operation);
  const output = result.output;
  const ext = path.extname(output).toLowerCase();
  const name = path.basename(output);
  const data = fs.readFileSync(output);
  if (ext === '.jpg' || ext === '.jpeg') {
    await sock.sendMessage(chatId, { image: data, caption: `✅ تم التحويل بنجاح\n${icon} ${label}: ${name}` }, { quoted: message });
  } else if (ext === '.zip') {
    await sock.sendMessage(chatId, { document: data, fileName: name, mimetype: 'application/zip', caption: `✅ تم تحويل PDF إلى صور.\n📦 تم جمع الصفحات في ملف ZIP.` }, { quoted: message });
  } else {
    const mime = ext === '.pdf' ? 'application/pdf' : ext === '.docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : ext === '.pptx' ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation' : ext === '.xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/octet-stream';
    await sock.sendMessage(chatId, { document: data, fileName: name, mimetype: mime, caption: `✅ اكتملت العملية\n${icon} ${label}` }, { quoted: message });
  }
}

async function executePdf(sock, chatId, message, senderId, media, operation) {
  const ext = safeExt(media.name, media.mime);
  if (!ext) throw new Error('نوع الملف غير مدعوم');
  await sock.sendMessage(chatId, { text: `⏳ جاري تنفيذ العملية...\n📄 ${media.name || 'الملف'}\n\nقد تستغرق العملية بعض الوقت حسب حجم الملف وعدد الصفحات.` }, { quoted: message });
  const buffer = await downloadMedia(media);
  const result = await processBuffer({ buffer, name: media.name, mime: media.mime, operation });
  try { await sendResult(sock, chatId, message, result, operation); }
  finally { cleanup(result.dir); }
}


function isMultiImageRequest(value) {
  const t = String(value || '').trim().toLowerCase();
  return /^(multi|multiple|images|merge|دمج|متعدد|متعددة|صور|جمع)$/.test(t) || /(?:دمج|متعدد|متعددة)\s*(?:الصور|صور)?/.test(t);
}

function isFinishMultiRequest(value) {
  const t = String(value || '').trim().toLowerCase();
  return /^(done|finish|stop|end|تم|انتهى|انهاء|إنهاء|خلص)$/.test(t);
}

async function addImageToMultiSession(sock, chatId, message, senderId, media) {
  const session = sessions.get('pdf-images', chatId, senderId);
  if (!session || !media || !/^image\//i.test(media.mime || '')) return false;
  if (session.data.inputs.length >= MULTI_IMAGE_MAX) {
    await sock.sendMessage(chatId, { text: `⚠️ وصلت للحد الأقصى: ${MULTI_IMAGE_MAX} صورة. أرسل «تم» لإنشاء PDF.` }, { quoted: message });
    return true;
  }
  const buffer = await downloadMedia(media);
  if (buffer.length > MAX_BYTES) throw new Error('الصورة أكبر من الحد المسموح.');
  const ext = safeExt(media.name, media.mime) || 'jpg';
  const input = path.join(session.data.dir, `image-${session.data.inputs.length + 1}.${ext}`);
  fs.writeFileSync(input, buffer, { mode: 0o600 });
  session.data.inputs.push(input);
  session.data.names.push(media.name || `image-${session.data.inputs.length}`);
  sessions.touch(session);
  await sock.sendMessage(chatId, { text: `✅ تمت إضافة الصورة رقم ${session.data.inputs.length}.\nأرسل صورة أخرى، أو أرسل «تم» لإنشاء PDF.` }, { quoted: message });
  return true;
}

async function handlePdfImageCollection(sock, chatId, message, senderId, text = '') {
  if (!senderId) return false;
  const session = sessions.get('pdf-images', chatId, senderId);
  if (!session) return false;
  if (isFinishMultiRequest(text)) {
    if (!session.data.inputs.length) { clearSession(session, 'empty'); return false; }
    try {
      await sock.sendMessage(chatId, { text: `⏳ جاري دمج ${session.data.inputs.length} صورة في PDF واحد...` }, { quoted: message });
      const result = await processMultipleFilePaths({ inputs: session.data.inputs, operation: 'image-to-pdf' });
      await sendResult(sock, chatId, message, result, 'image-to-pdf');
    } catch (e) {
      await sock.sendMessage(chatId, { text: `❌ تعذر إنشاء PDF من الصور.\n${e.message || 'حدث خطأ غير متوقع.'}` }, { quoted: message });
    } finally { clearSession(session, 'completed'); }
    return true;
  }
  const media = sourceFrom(message);
  if (media && /^image\//i.test(media.mime || '')) return addImageToMultiSession(sock, chatId, message, senderId, media);
  return false;
}

async function pdfCommand(sock, chatId, message, args, ctx = {}) {
  const media = sourceFrom(message);
  if (!media) {
    return sock.sendMessage(chatId, { text: '📄 أرسل ملف Word أو PowerPoint أو Excel أو صورة مع الأمر `.pdf`، أو رد بالأمر `.pdf` على الملف.\n\n🖼️ لدمج عدة صور: أرسل أول صورة مع `.pdf متعدد`، ثم أرسل بقية الصور، وفي النهاية أرسل `تم`.' }, { quoted: message });
  }
  const ext = safeExt(media.name, media.mime);
  if (!ext) return sock.sendMessage(chatId, { text: '❌ صيغة الملف غير مدعومة. المدعوم: PDF, Word, PowerPoint, Excel والصور.' }, { quoted: message });
  const ownerId = ctx.senderId || message.key?.participant || message.key?.remoteJid || 'unknown';
  const requestedTask = Array.isArray(args) ? args.join(' ').trim() : String(args || '').trim();
  if (ext && /^image\//i.test(media.mime || '') && isMultiImageRequest(requestedTask)) {
    const dir = makeJobDir();
    const session = sessions.create({
      type: 'pdf-images', chatId, ownerId, ttl: 5 * 60 * 1000,
      data: { dir, inputs: [], names: [] },
      onClose: s => { if (s?.data?.dir) cleanup(s.data.dir); }
    });
    await addImageToMultiSession(sock, chatId, message, ownerId, media);
    await sock.sendMessage(chatId, { text: `🖼️ وضع دمج الصور مفعّل.\n📌 أرسِل الصور واحدة تلو الأخرى.\n🛑 عند الانتهاء أرسل: تم\n\nالحد الأقصى: ${MULTI_IMAGE_MAX} صورة.` }, { quoted: message });
    return;
  }
  if (ext === 'pdf') {
    const buffer = await downloadMedia(media);
    const pdfRequestedTask = requestedTask;
    if (pdfRequestedTask && !/^(1|2|3|4|5|6|7|١|٢|٣|٤|٥|٦|٧)$/.test(pdfRequestedTask)) {
      try {
        await sock.sendMessage(chatId, { text: '🧠 جاري تحليل المستند والإجابة عن طلبك...' }, { quoted: message });
        const result = await documents.analyze({ buffer, name: media.name || 'document.pdf', mime: media.mime || 'application/pdf', question: pdfRequestedTask, chatId, userId: ownerId });
        await sock.sendMessage(chatId, { text: `🧠 *تحليل المستند*\n\n${result.answer}` }, { quoted: message });
      } catch (e) {
        await sock.sendMessage(chatId, { text: `❌ تعذر تحليل المستند.\n${e.message || 'حدث خطأ غير متوقع.'}` }, { quoted: message });
      }
      return;
    }
    const dir = makeJobDir();
    const input = path.join(dir, `input.pdf`);
    fs.writeFileSync(input, buffer, { mode: 0o600 });
    const session = createSession(chatId, ownerId, { dir, input, mediaName: media.name || 'document.pdf' });
    const sent = await sock.sendMessage(chatId, { text: menuText() }, { quoted: message });
    sessions.setActiveMessage(session, sent?.key?.id || null);
    return;
  }
  const operation = ['doc','docx','ppt','pptx','xls','xlsx'].includes(ext) ? 'office-to-pdf' : 'image-to-pdf';
  return executePdf(sock, chatId, message, ctx.senderId || message.key?.participant, media, operation);
}

async function handlePdfReply(sock, chatId, message, senderId, text) {
  if (!senderId) return false;

  // PDF menu numbers are valid ONLY as a reply to the exact PDF menu message.
  // Reject ordinary 1-6 messages before touching the PDF session at all.
  if (!interaction.reply(message).ok) return false;

  const session = sessions.get('pdf', chatId, senderId);
  if (!session) return false;

  const parsed = interaction.replyNumber(message, session.activeMessageId, { min: 1, max: 7 });
  if (!parsed.ok) return false;
  if (parsed.value === 7) {
    try {
      await sock.sendMessage(chatId, { text: '🧠 جاري قراءة المستند وتحليله بالذكاء الاصطناعي...\n⏳ سيتم الاعتماد على النص المستخرج من الملف مع ذكر أرقام الصفحات عند الإمكان.' }, { quoted: message });
      const buffer = fs.readFileSync(session.data.input);
      const result = await documents.analyze({ buffer, name: session.data.mediaName, mime: 'application/pdf', chatId, userId: senderId });
      await sock.sendMessage(chatId, { text: `🧠 *التحليل الذكي*\n\n${result.answer}` }, { quoted: message });
    } catch (e) {
      await sock.sendMessage(chatId, { text: `❌ تعذر تحليل المستند.\n${e.message || 'حدث خطأ غير متوقع.'}` }, { quoted: message });
    } finally {
      clearSession(session, 'completed');
    }
    return true;
  }

  const op = operationForNumber(parsed.value);
  try {
    await sock.sendMessage(chatId, { text: `⏳ تم اختيار العملية ${parsed.value}
📄 جاري المعالجة الآن...` }, { quoted: message });
    const result = await processFilePath({ input: session.data.input, operation: op });
    await sendResult(sock, chatId, message, result, op);
  } catch (e) {
    await sock.sendMessage(chatId, { text: `❌ تعذر تنفيذ العملية.\n${e.message || 'حدث خطأ غير متوقع.'}` }, { quoted: message });
  } finally {
    clearSession(session, 'completed');
  }
  return true;
}

const definition = {
  name:'pdf', aliases:[], localizedAliases:[], localizedName:'PDF', category:'utility', categoryKey:'utility',
  usage:'.pdf', description:'تحويل ومعالجة ملفات PDF وOffice والصور.', method:'أرسل الملف مع `.pdf` أو رد بالأمر على الملف.',
  version:'1.35.6', developer:'Leonardo', execute:pdfCommand
};

module.exports = { pdfCommand, handlePdfReply, handlePdfImageCollection, definition };
