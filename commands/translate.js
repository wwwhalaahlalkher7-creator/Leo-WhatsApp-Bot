const response = require('../systems/response');
const input = require('../systems/input');
const { t } = require('../lib/i18n');
const fetch = require('node-fetch');
const { firstAvailable, define } = require('../systems/provider');
const capabilities = require('../systems/ai/capabilities');
const media = require('../systems/ai/media');

const LANGS = {
  ar: 'ar', العربية: 'ar', العربيه: 'ar', عربي: 'ar',
  en: 'en', english: 'en', انجليزي: 'en', الإنجليزية: 'en', الانجليزية: 'en',
  fr: 'fr', french: 'fr', الفرنسية: 'fr', فرنسي: 'fr',
  es: 'es', spanish: 'es', الإسبانية: 'es', الاسبانية: 'es', اسباني: 'es',
  de: 'de', german: 'de', الألمانية: 'de', الالمانية: 'de', ألماني: 'de',
  it: 'it', italian: 'it', الإيطالية: 'it', الايطالية: 'it', إيطالي: 'it',
  pt: 'pt', portuguese: 'pt', البرتغالية: 'pt', البرتغاليه: 'pt',
  ru: 'ru', russian: 'ru', روسي: 'ru', الروسية: 'ru', الروسيه: 'ru',
  ja: 'ja', japanese: 'ja', اليابانية: 'ja', ياباني: 'ja',
  ko: 'ko', korean: 'ko', الكورية: 'ko', كوري: 'ko',
  zh: 'zh-CN', 'zh-cn': 'zh-CN', chinese: 'zh-CN', الصينية: 'zh-CN', صيني: 'zh-CN',
  zh_tw: 'zh-TW', 'zh-tw': 'zh-TW', 'الصينية التقليدية': 'zh-TW',
  hi: 'hi', hindi: 'hi', الهندية: 'hi', هندي: 'hi',
  tr: 'tr', turkish: 'tr', التركية: 'tr', تركي: 'tr',
  nl: 'nl', dutch: 'nl', الهولندية: 'nl', هولندي: 'nl',
  pl: 'pl', polish: 'pl', البولندية: 'pl', بولندي: 'pl',
  uk: 'uk', ukrainian: 'uk', الأوكرانية: 'uk', اوكراني: 'uk',
  sv: 'sv', swedish: 'sv', السويدية: 'sv', سويدي: 'sv',
  no: 'no', norwegian: 'no', النرويجية: 'no', نرويجي: 'no',
  da: 'da', danish: 'da', الدنماركية: 'da', دنماركي: 'da',
  fi: 'fi', finnish: 'fi', الفنلندية: 'fi', فنلندي: 'fi',
  cs: 'cs', czech: 'cs', التشيكية: 'cs', تشيكي: 'cs',
  ro: 'ro', romanian: 'ro', الرومانية: 'ro', روماني: 'ro',
  hu: 'hu', hungarian: 'hu', المجرية: 'hu', مجري: 'hu',
  el: 'el', greek: 'el', اليونانية: 'el', يوناني: 'el',
  he: 'he', hebrew: 'he', العبرية: 'he', عبري: 'he',
  id: 'id', indonesian: 'id', الإندونيسية: 'id', اندونيسي: 'id',
  ms: 'ms', malay: 'ms', الملايوية: 'ms', ملايوي: 'ms',
  vi: 'vi', vietnamese: 'vi', الفيتنامية: 'vi', فيتنامي: 'vi',
  th: 'th', thai: 'th', التايلاندية: 'th', تايلاندي: 'th',
  fa: 'fa', persian: 'fa', الفارسية: 'fa', فارسي: 'fa',
  ur: 'ur', urdu: 'ur', الأوردية: 'ur', اردو: 'ur',
  bn: 'bn', bengali: 'bn', البنغالية: 'bn', بنغالي: 'bn',
  sw: 'sw', swahili: 'sw', السواحلية: 'sw', سواحلي: 'sw',
  af: 'af', afrikaans: 'af', الأفريكانية: 'af',
  ca: 'ca', catalan: 'ca', الكتالونية: 'ca',
  eu: 'eu', basque: 'eu', الباسكية: 'eu',
  gl: 'gl', galician: 'gl', الجاليكية: 'gl',
  sk: 'sk', slovak: 'sk', السلوفاكية: 'sk',
  sl: 'sl', slovenian: 'sl', السلوفينية: 'sl',
  bg: 'bg', bulgarian: 'bg', البلغارية: 'bg',
  sr: 'sr', serbian: 'sr', الصربية: 'sr',
  hr: 'hr', croatian: 'hr', الكرواتية: 'hr',
  et: 'et', estonian: 'et', الإستونية: 'et',
  lv: 'lv', latvian: 'lv', اللاتفية: 'lv',
  lt: 'lt', lithuanian: 'lt', الليتوانية: 'lt',
  is: 'is', icelandic: 'is', الآيسلندية: 'is',
  sq: 'sq', albanian: 'sq', الألبانية: 'sq',
  mk: 'mk', macedonian: 'mk', المقدونية: 'mk'
};

function normalizeLang(value) {
  const key = String(value || '').trim().toLowerCase();
  return LANGS[key] || (key.length >= 2 && key.length <= 5 ? key : null);
}
function detectSource(text) {
  if (/\p{Script=Arabic}/u.test(text)) return 'ar';
  if (/\p{Script=Cyrillic}/u.test(text)) return 'ru';
  if (/[\u3040-\u30ff]/u.test(text)) return 'ja';
  if (/[\u4e00-\u9fff]/u.test(text)) return 'zh-CN';
  if (/^[\s\p{P}\d]+$/u.test(text)) return 'en';
  return 'en';
}

async function handleTranslateCommand(sock, chatId, message, match) {
  try {
    let textToTranslate = '';
    let lang = '';
    const mediaTarget = media.currentOrQuoted(message);
    // Voice messages can be translated in-place: `.ترجمة en` while replying
    // to audio. OmniRoute's native audio translation is used when available;
    // otherwise Leo transcribes first and translates the transcript.
    if (mediaTarget?.type === 'audio') {
      lang = match.trim().split(/\s+/).filter(Boolean).pop() || '';
      const target = normalizeLang(lang);
      if (!target) {
        return response.text(sock, chatId, '🎙️ للترجمة الصوتية: رد على التسجيل الصوتي واكتب مثلًا `.ترجمة en`.', message);
      }
      const audio = await media.download(mediaTarget);
      let transcript;
      if (target === 'en' && capabilities.has('audioTranslation')) {
        try { transcript = await capabilities.audioTranslation(audio, media.filename(mediaTarget), media.mime(mediaTarget)); } catch (_) {}
      }
      if (!transcript) transcript = await capabilities.audioTranscription(audio, media.filename(mediaTarget), media.mime(mediaTarget));
      if (!transcript) throw new Error('تعذر استخراج النص من التسجيل الصوتي');
      textToTranslate = transcript;
      // Continue through the normal text translation pipeline below.
    }
    const quotedMessage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!mediaTarget || mediaTarget.type !== 'audio') {
      if (quotedMessage) {
        textToTranslate = input.quotedText(message);
        lang = match.trim();
      } else {
      const args = match.trim().split(/\s+/);
      if (args.length < 2) {
        return response.text(sock, chatId, '🌐 *الترجمة*\n\n• رد على رسالة ثم اكتب: `.ترجمة ar`\n• أو اكتب: `.ترجمة hello ar`\n\nأمثلة: `ar` العربية، `en` الإنجليزية، `fr` الفرنسية، `de` الألمانية، `ja` اليابانية، `ru` الروسية، `es` الإسبانية، `tr` التركية، `zh-CN` الصينية، `ko` الكورية. ويمكن استخدام أسماء اللغات بالعربية أيضًا.', message);
      }
        lang = args.pop();
        textToTranslate = args.join(' ');
      }
    }

    const target = normalizeLang(lang);
    if (!target) throw new Error('Invalid target language');
    if (!textToTranslate) return response.text(sock, chatId, t('media.translate.noText'), message);

    const source = detectSource(textToTranslate);
    if (source === target) { await response.text(sock, chatId, `🌐 ${textToTranslate}`, message); return; }

    let translatedText = null;
    // Stage 6: route translation through Leo's capability layer first. This
    // lets OmniRoute use the configured translation-capable AI while keeping
    // the existing deterministic web translators as a fallback.
    if (capabilities.has('translation')) {
      try {
        translatedText = await capabilities.translation(textToTranslate, target, { source });
      } catch (error) {
        console.warn('[TRANSLATE] AI translation failed, using web fallback:', error?.message || error);
      }
    }
    if (!translatedText) {
      const providers = [
        define('google-translate', { async translate() {
          const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(target)}&dt=t&q=${encodeURIComponent(textToTranslate)}`);
          if (!res.ok) return null;
          const data = await res.json();
          return data?.[0]?.map(x => x?.[0] || '').join('').trim() || null;
        }}),
        define('mymemory', { async translate() {
          const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(textToTranslate)}&langpair=${encodeURIComponent(source)}%7C${encodeURIComponent(target)}`);
          if (!res.ok) return null;
          const data = await res.json();
          return data?.responseData?.translatedText?.trim() || null;
        }})
      ];
      const translation = await firstAvailable(providers, 'translate');
      translatedText = translation.ok ? translation.value : null;
    }
    if (!translatedText) throw new Error('Translation providers failed');
    await response.text(sock, chatId, `🌐 ${translatedText}`, message);
  } catch (error) {
    console.error('❌ Error in translate command:', error?.message || error);
    await response.text(sock, chatId, '❌ تعذرت الترجمة. تأكد من رمز اللغة وحاول مرة ثانية. مثال: `.ترجمة hello ar`', message);
  }
}

module.exports = { handleTranslateCommand };
