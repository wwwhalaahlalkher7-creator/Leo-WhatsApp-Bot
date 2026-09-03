const fs = require('fs');
const path = require('path');

const main = fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8');
const forbiddenDirectImports = [
  'yt-search',
  'node-fetch',
  'ytdl-core',
  'axios',
  'fluent-ffmpeg',
];

const errors = [];
for (const dep of forbiddenDirectImports) {
  const re = new RegExp(`require\\(["']${dep.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}["']\\)`);
  if (re.test(main)) errors.push(`main.js still directly imports ${dep}`);
}

const forbiddenCommandImports = [
  './commands/ban', './commands/mute', './commands/sticker', './commands/warn',
  './commands/warnings', './commands/delete',
  './commands/kick', './commands/simage', './commands/weather', './commands/news',
  './commands/lyrics', './commands/img-blur', './commands/character', './commands/wanted',
  './commands/ship', './commands/groupinfo', './commands/unban', './commands/viewonce',
  './commands/clearsession', './commands/setpp', './commands/groupmanage', './commands/song',
  './commands/ai', './commands/translate', './commands/ss', './commands/imagine',
  './commands/image-search', './commands/video', './commands/removebg', './commands/remini',
  './commands/pmblocker', './commands/sora', './commands/botstate', './commands/approve',
  './commands/antibadword',
];
for (const mod of forbiddenCommandImports) {
  if (main.includes(`require('${mod}')`) || main.includes(`require("${mod}")`)) {
    errors.push(`main.js still directly imports registry-routed module ${mod}`);
  }
}

if (errors.length) {
  console.error('Main routing audit FAILED');
  errors.forEach(e => console.error(`- ${e}`));
  process.exit(1);
}
console.log('Main routing audit PASS: main.js contains no known dead direct command/provider imports.');
