const response = require('../systems/response');
const gTTS = require('gtts');
const fs = require('fs');
const path = require('path');
const { optimizeAudio, cleanup } = require('../lib/media-optimizer');
const capabilities = require('../systems/ai/capabilities');

let EdgeTTS = null;
try {
  ({ EdgeTTS } = require('node-edge-tts'));
} catch (_) {
  // Optional dependency. gTTS remains the compatibility fallback.
}

// Edge voices provide real male/female neural voices. The Arabic command `.قول`
// uses male voices, while `.قولي` and the English `.tts` command use female voices.
// The same language aliases are accepted by both commands.
const VOICES = {
  ar: { locale: 'ar-SA', male: 'ar-SA-HamedNeural', female: 'ar-SA-ZariyahNeural' },
  en: { locale: 'en-US', male: 'en-US-GuyNeural', female: 'en-US-AriaNeural' },
  fr: { locale: 'fr-FR', male: 'fr-FR-HenriNeural', female: 'fr-FR-DeniseNeural' },
  ja: { locale: 'ja-JP', male: 'ja-JP-KeitaNeural', female: 'ja-JP-NanamiNeural' },
  ru: { locale: 'ru-RU', male: 'ru-RU-DmitryNeural', female: 'ru-RU-SvetlanaNeural' },
  es: { locale: 'es-ES', male: 'es-ES-AlvaroNeural', female: 'es-ES-ElviraNeural' },
  de: { locale: 'de-DE', male: 'de-DE-ConradNeural', female: 'de-DE-KatjaNeural' },
  it: { locale: 'it-IT', male: 'it-IT-DiegoNeural', female: 'it-IT-ElsaNeural' },
  pt: { locale: 'pt-BR', male: 'pt-BR-AntonioNeural', female: 'pt-BR-FranciscaNeural' },
  'zh-CN': { locale: 'zh-CN', male: 'zh-CN-YunxiNeural', female: 'zh-CN-XiaoxiaoNeural' },
  'zh-TW': { locale: 'zh-TW', male: 'zh-TW-YunJheNeural', female: 'zh-TW-HsiaoChenNeural' },
  ko: { locale: 'ko-KR', male: 'ko-KR-InJoonNeural', female: 'ko-KR-SunHiNeural' },
  tr: { locale: 'tr-TR', male: 'tr-TR-AhmetNeural', female: 'tr-TR-EmelNeural' },
  nl: { locale: 'nl-NL', male: 'nl-NL-MaartenNeural', female: 'nl-NL-ColetteNeural' },
  pl: { locale: 'pl-PL', male: 'pl-PL-MarekNeural', female: 'pl-PL-ZofiaNeural' },
  uk: { locale: 'uk-UA', male: 'uk-UA-OstapNeural', female: 'uk-UA-PolinaNeural' },
  hi: { locale: 'hi-IN', male: 'hi-IN-MadhurNeural', female: 'hi-IN-SwaraNeural' },
  cs: { locale: 'cs-CZ', male: 'cs-CZ-AntoninNeural', female: 'cs-CZ-VlastaNeural' },
  ro: { locale: 'ro-RO', male: 'ro-RO-EmilNeural', female: 'ro-RO-AlinaNeural' },
  hu: { locale: 'hu-HU', male: 'hu-HU-TamasNeural', female: 'hu-HU-NoemiNeural' },
  el: { locale: 'el-GR', male: 'el-GR-NestorasNeural', female: 'el-GR-AthinaNeural' },
  he: { locale: 'he-IL', male: 'he-IL-AvriNeural', female: 'he-IL-HilaNeural' },
  id: { locale: 'id-ID', male: 'id-ID-ArdiNeural', female: 'id-ID-GadisNeural' },
  ms: { locale: 'ms-MY', male: 'ms-MY-OsmanNeural', female: 'ms-MY-YasminNeural' },
  vi: { locale: 'vi-VN', male: 'vi-VN-NamMinhNeural', female: 'vi-VN-HoaiMyNeural' },
  th: { locale: 'th-TH', male: 'th-TH-NiwatNeural', female: 'th-TH-PremwadeeNeural' },
  fa: { locale: 'fa-IR', male: 'fa-IR-FaridNeural', female: 'fa-IR-DilaraNeural' },
  ur: { locale: 'ur-PK', male: 'ur-PK-AsadNeural', female: 'ur-PK-UzmaNeural' },
  bn: { locale: 'bn-IN', male: 'bn-IN-BashkarNeural', female: 'bn-IN-TanishaaNeural' },
  sv: { locale: 'sv-SE', male: 'sv-SE-MattiasNeural', female: 'sv-SE-SofieNeural' },
  no: { locale: 'nb-NO', male: 'nb-NO-FinnNeural', female: 'nb-NO-PernilleNeural' },
  da: { locale: 'da-DK', male: 'da-DK-JeppeNeural', female: 'da-DK-ChristelNeural' },
  fi: { locale: 'fi-FI', male: 'fi-FI-HarriNeural', female: 'fi-FI-NooraNeural' },
  bg: { locale: 'bg-BG', male: 'bg-BG-BorislavNeural', female: 'bg-BG-KalinaNeural' },
  sr: { locale: 'sr-RS', male: 'sr-RS-NicholasNeural', female: 'sr-RS-SophieNeural' },
  hr: { locale: 'hr-HR', male: 'hr-HR-SreckoNeural', female: 'hr-HR-GabrijelaNeural' },
  sk: { locale: 'sk-SK', male: 'sk-SK-LukasNeural', female: 'sk-SK-ViktoriaNeural' },
  sl: { locale: 'sl-SI', male: 'sl-SI-PetraNeural', female: 'sl-SI-RokNeural' },
  et: { locale: 'et-EE', male: 'et-EE-KertNeural', female: 'et-EE-AnuNeural' },
  lv: { locale: 'lv-LV', male: 'lv-LV-NilsNeural', female: 'lv-LV-EveritaNeural' },
  lt: { locale: 'lt-LT', male: 'lt-LT-LeonasNeural', female: 'lt-LT-OnaNeural' },
};

const LANGS = {
  ar:'ar', العربية:'ar', العربيه:'ar', عربي:'ar',
  en:'en', english:'en', انجليزي:'en', الإنجليزية:'en', الانجليزية:'en', إنجليزي:'en',
  fr:'fr', french:'fr', الفرنسية:'fr', فرنسي:'fr',
  es:'es', spanish:'es', الإسبانية:'es', الاسبانية:'es', اسباني:'es',
  de:'de', german:'de', الألمانية:'de', الالمانية:'de', ألماني:'de',
  it:'it', italian:'it', الإيطالية:'it', الايطالية:'it', إيطالي:'it',
  pt:'pt', portuguese:'pt', البرتغالية:'pt', البرتغاليه:'pt', برتغالي:'pt',
  ru:'ru', russian:'ru', روسي:'ru', الروسية:'ru', الروسيه:'ru',
  ja:'ja', japanese:'ja', اليابانية:'ja', ياباني:'ja',
  ko:'ko', korean:'ko', الكورية:'ko', كوري:'ko',
  zh:'zh-CN', 'zh-cn':'zh-CN', chinese:'zh-CN', الصينية:'zh-CN', صيني:'zh-CN', 'الصينية المبسطة':'zh-CN',
  'zh-tw':'zh-TW', 'zh_tw':'zh-TW', traditionalchinese:'zh-TW', 'الصينية التقليدية':'zh-TW',
  hi:'hi', hindi:'hi', الهندية:'hi', هندي:'hi',
  tr:'tr', turkish:'tr', التركية:'tr', تركي:'tr',
  nl:'nl', dutch:'nl', الهولندية:'nl', هولندي:'nl',
  pl:'pl', polish:'pl', البولندية:'pl', بولندي:'pl',
  uk:'uk', ukrainian:'uk', الأوكرانية:'uk', اوكراني:'uk',
  sv:'sv', swedish:'sv', السويدية:'sv', سويدي:'sv',
  no:'no', norwegian:'no', النرويجية:'no', نرويجي:'no',
  da:'da', danish:'da', الدنماركية:'da', دنماركي:'da',
  fi:'fi', finnish:'fi', الفنلندية:'fi', فنلندي:'fi',
  cs:'cs', czech:'cs', التشيكية:'cs', تشيكي:'cs',
  ro:'ro', romanian:'ro', الرومانية:'ro', روماني:'ro',
  hu:'hu', hungarian:'hu', المجرية:'hu', مجري:'hu',
  el:'el', greek:'el', اليونانية:'el', يوناني:'el',
  he:'he', hebrew:'he', العبرية:'he', عبري:'he',
  id:'id', indonesian:'id', الإندونيسية:'id', اندونيسي:'id',
  ms:'ms', malay:'ms', الملايوية:'ms', ملايوي:'ms',
  vi:'vi', vietnamese:'vi', الفيتنامية:'vi', فيتنامي:'vi',
  th:'th', thai:'th', التايلاندية:'th', تايلاندي:'th',
  fa:'fa', persian:'fa', الفارسية:'fa', فارسي:'fa',
  ur:'ur', urdu:'ur', الأوردية:'ur', اردو:'ur',
  bn:'bn', bengali:'bn', البنغالية:'bn', بنغالي:'bn',
  bg:'bg', bulgarian:'bg', البلغارية:'bg',
  sr:'sr', serbian:'sr', الصربية:'sr',
  hr:'hr', croatian:'hr', الكرواتية:'hr',
  sk:'sk', slovak:'sk', السلوفاكية:'sk',
  sl:'sl', slovenian:'sl', السلوفينية:'sl',
  et:'et', estonian:'et', الإستونية:'et',
  lv:'lv', latvian:'lv', اللاتفية:'lv',
  lt:'lt', lithuanian:'lt', الليتوانية:'lt'
};

function normalizeLang(value) {
  const key = String(value || '').trim().toLowerCase();
  return LANGS[key] || (VOICES[key] ? key : null);
}

// Detect the language from the actual text. Arabic and English are the
// primary expected languages; common Unicode scripts cover other languages
// without requiring the user to provide a language code.
function detectLanguage(text = '') {
  const value = String(text || '');
  const counts = {
    ar: (value.match(/[\u0600-\u06FF]/g) || []).length,
    en: (value.match(/[A-Za-z]/g) || []).length,
    ru: (value.match(/[\u0400-\u04FF]/g) || []).length,
    ja: (value.match(/[\u3040-\u30FF]/g) || []).length,
    ko: (value.match(/[\uAC00-\uD7AF]/g) || []).length,
    zh: (value.match(/[\u3400-\u9FFF]/g) || []).length,
    he: (value.match(/[\u0590-\u05FF]/g) || []).length,
    hi: (value.match(/[\u0900-\u097F]/g) || []).length,
    th: (value.match(/[\u0E00-\u0E7F]/g) || []).length,
  };
  const ordered = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (!ordered[0] || ordered[0][1] === 0) return 'ar';
  if (ordered[0][0] === 'zh') return 'zh-CN';
  return ordered[0][0];
}

function prepareSpeechText(value) {
  let text = String(value || '').replace(/\u0640/g, '').replace(/[ \t]+/g, ' ').trim();
  text = text.replace(/([.!؟؛:،]){2,}/g, '$1').replace(/\n{2,}/g, '\n');
  return text;
}

function parseArgs(value) {
  const raw = prepareSpeechText(value);
  const parts = raw.split(/\s+/);
  const explicit = normalizeLang(parts[0]);
  if (explicit) {
    const text = parts.slice(1).join(' ').trim();
    return { text, lang: explicit };
  }
  return { text: raw, lang: detectLanguage(raw) };
}

function helpText() {
  return [
    '🗣️ *تحويل النص إلى صوت*',
    '',
    '• `.قول مرحبًا` — صوت ذكر',
    '• `.قولي مرحبًا` — صوت أنثى',
    '',
    '🤖 اللغة تُكتشف تلقائيًا من النص، مع أولوية للعربية والإنجليزية.',
    'يمكنك أيضًا كتابة رمز اللغة قبل النص مثل: `.قول en Hello` أو `.قول ar مرحبًا`.',
    'السرعة مضبوطة افتراضيًا على نطق هادئ وواضح.'
  ].join('\\n');
}

async function saveWithEdgeTTS(text, filePath, lang, gender) {
  if (!EdgeTTS) throw new Error('node-edge-tts is not installed');
  const config = VOICES[lang] || VOICES.ar;
  const voice = config[gender] || config.female;
  const tts = new EdgeTTS({
    voice,
    lang: config.locale,
    outputFormat: 'audio-24khz-48kbitrate-mono-mp3',
    // Slightly slower than the Edge default for clearer Arabic and mixed-language speech.
    rate: lang === 'ar' ? '-8%' : '-5%',
    pitch: 'default',
    volume: 'default',
    timeout: 20000,
  });
  await tts.ttsPromise(text, filePath);
}

async function saveWithGoogle(text, filePath, lang) {
  const gtts = new gTTS(text, lang === 'zh-CN' ? 'zh-CN' : lang === 'zh-TW' ? 'zh-TW' : lang);
  await new Promise((resolve, reject) => gtts.save(filePath, err => err ? reject(err) : resolve()));
}

async function ttsCommand(sock, chatId, rawText, message, options = {}) {
  const gender = options.gender === 'male' ? 'male' : 'female';
  const { text, lang } = parseArgs(rawText);
  if (!text) {
    await response.text(sock, chatId, helpText(), message);
    return;
  }

  const filePath = path.join(__dirname, '..', 'assets', `tts-${Date.now()}-${Math.random().toString(16).slice(2)}.mp3`);
  try {
    // Arabic deliberately uses the local neural voice path so `.قول` is male
    // and `.قولي` is female. Other languages keep the AI/OmniRoute path first.
    let omniUsed = false;
    if (lang !== 'ar' && capabilities.has('speechSynthesis')) {
      try {
        const audio = await capabilities.speechSynthesis(text, { lang, gender });
        if (Buffer.isBuffer(audio) && audio.length >= 1000) {
          await fs.promises.writeFile(filePath, audio);
          omniUsed = true;
        }
      } catch (omniError) {
        console.warn('[TTS] OmniRoute unavailable, using local language fallback:', omniError?.message || omniError);
      }
    }
    if (!omniUsed) {
      try {
        await saveWithEdgeTTS(text, filePath, lang, gender);
      } catch (edgeError) {
        console.warn('[TTS] Edge TTS unavailable, using gTTS fallback:', edgeError?.message || edgeError);
        await saveWithGoogle(text, filePath, lang);
      }
    }
    const optimized = await optimizeAudio(filePath, { bitrate: '64k', mono: true });
    const stat = await fs.promises.stat(optimized);
    if (stat.size < 1000) throw new Error('ملف الصوت الناتج فارغ أو غير صالح.');
    try {
      await sock.sendMessage(chatId, {
        audio: { url: optimized },
        mimetype: 'audio/mpeg',
        fileName: 'tts.mp3',
        ptt: false
      }, { quoted: message });
    } finally {
      cleanup(optimized);
    }
  } catch (error) {
    console.error('[TTS]', error);
    await response.text(sock, chatId, '❌ تعذر إنشاء الرسالة الصوتية حاليًا. جرّب لغة أخرى أو أعد المحاولة لاحقًا.', message);
  } finally {
    try { fs.unlinkSync(filePath); } catch {}
  }
}

module.exports = ttsCommand;
module.exports.helpText = helpText;
module.exports.normalizeLang = normalizeLang;
