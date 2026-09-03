const health = require('./core/health');

// Lightweight reachability probes only. They do NOT perform media downloads or AI generation.
const probes = [
  ['vapis-gemini', 'https://vapis.my.id/'],
  ['siputzx-gemini', 'https://api.siputzx.my.id/'],
  ['ryzendesu-gemini', 'https://api.ryzendesu.vip/'],
  ['gifted-gemini', 'https://api.giftedtech.my.id/'],
  ['EliteProTech', 'https://eliteprotech-apis.zone.id/'],
  ['Yupra', 'https://api.yupra.my.id/'],
  ['Okatsu', 'https://okatsu-rolezapiiz.vercel.app/'],
  ['Keith', 'https://apis-keith.vercel.app/'],
  ['Siputzx', 'https://api.siputzx.my.id/'],
  ['Hanggts', 'https://api.hanggts.xyz/'],
];

async function runHealthChecks() {
  const results = [];
  for (const [name, url] of probes) {
    if (name === 'gifted-gemini' && !process.env.GIFTED_API_KEY) {
      results.push({ name, ok: false, status: 'disabled', error: 'GIFTED_API_KEY not configured' });
      continue;
    }
    results.push(await health.probe(name, url));
  }
  return results;
}

module.exports = { probes, runHealthChecks, snapshot: health.snapshot };
