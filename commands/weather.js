const settings = require('../settings');
const input = require('../systems/input');
const response = require('../systems/response');
const axios = require('axios');
const { firstAvailable, define } = require('../systems/provider');
const { t } = require('../lib/i18n');

const weatherCode = {
  0: 'سماء صافية', 1: 'غالبًا صافٍ', 2: 'غائم جزئيًا', 3: 'غائم',
  45: 'ضباب', 48: 'ضباب متجمد', 51: 'رذاذ خفيف', 53: 'رذاذ متوسط', 55: 'رذاذ كثيف',
  61: 'مطر خفيف', 63: 'مطر متوسط', 65: 'مطر غزير', 71: 'ثلج خفيف', 73: 'ثلج متوسط',
  75: 'ثلج غزير', 80: 'زخات مطر خفيفة', 81: 'زخات مطر متوسطة', 82: 'زخات مطر قوية',
  95: 'عاصفة رعدية', 96: 'عاصفة رعدية مع بَرَد', 99: 'عاصفة رعدية مع بَرَد قوي'
};

module.exports = async function weatherCommand(sock, chatId, message, city) {
  try {
    const query = String(city || '').trim();
    if (!query) {
      await response.text(sock, chatId, '🌍 اكتب اسم المدينة، مثال: `.طقس الخرطوم`.', message);
      return;
    }

    const geo = await axios.get('https://geocoding-api.open-meteo.com/v1/search', {
      params: { name: query, count: 1, language: 'ar', format: 'json' }, timeout: 15000
    });
    const place = geo.data?.results?.[0];
    if (!place) {
      await response.text(sock, chatId, `❌ لم أجد مدينة باسم «${query}». جرّب كتابة الاسم بشكل أوضح.`, message);
      return;
    }

    const providers = [
      define('open-meteo', { async fetch() {
        const forecast = await axios.get('https://api.open-meteo.com/v1/forecast', { params: { latitude: place.latitude, longitude: place.longitude, current: 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m', timezone: 'auto' }, timeout: 15000 });
        return forecast.data?.current;
      }}),
      define('wttr', { async fetch() {
        const fallback = await axios.get(`https://wttr.in/${encodeURIComponent(query)}?format=j1`, { timeout: 15000, headers: { 'User-Agent': `LeoBot/${settings.version}` } });
        const cc = fallback.data?.current_condition?.[0];
        return cc ? { temperature_2m: Number(cc.temp_C), apparent_temperature: Number(cc.FeelsLikeC), relative_humidity_2m: Number(cc.humidity), wind_speed_10m: Number(cc.windspeedKmph), weather_code: 0, description: cc.weatherDesc?.[0]?.value || 'غير معروفة' } : null;
      }})
    ];
    const weatherResult = await firstAvailable(providers, 'fetch');
    const c = weatherResult.value;
    if (!c) throw new Error('No current weather data');

    const text = [
      `🌤️ *الطقس الآن — ${place.name}${place.country ? `، ${place.country}` : ''}*`,
      `🌡️ الحرارة: ${c.temperature_2m}°C`,
      `🌡️ المحسوسة: ${c.apparent_temperature}°C`,
      `💧 الرطوبة: ${c.relative_humidity_2m}%`,
      `💨 سرعة الرياح: ${c.wind_speed_10m} كم/س`,
      `☁️ الحالة: ${c.description || weatherCode[c.weather_code] || 'غير معروفة'}`
    ].join('\n');
    await response.text(sock, chatId, text, message);
  } catch (error) {
    console.error('Error fetching weather:', error?.message || error);
    await response.text(sock, chatId, '⚠️ تعذر جلب حالة الطقس حاليًا. جرّب اسم مدينة آخر بعد قليل.', message);
  }
};
