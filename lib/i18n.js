const ar = require('../locales/ar');
const settings = require('../settings');

// LeoBot is Arabic-only by design. Older releases persisted a language choice;
// ignore it so an old "en" state can never switch the bot back to English.
settings.language = 'ar';

function locale() { return ar; }
function t(path, fallback = '', vars = {}) {
  const parts = path.split('.'); let value = locale();
  for (const part of parts) value = value?.[part];
  value = value ?? fallback;
  if (typeof value !== 'string') return value;
  return value.replace(/\{(\w+)\}/g, (_, key) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : `{${key}}`
  );
}
async function setLanguage(language) {
  if (String(language || '').toLowerCase() !== 'ar') throw new Error('LeoBot يدعم العربية فقط.');
  settings.language = 'ar';
}
module.exports = { t, locale, setLanguage, catalogs: { ar } };
