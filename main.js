'use strict';

const fs = require('fs');
const path = require('path');

// Runtime temp directory is process infrastructure, not a message event.
const customTemp = path.join(process.cwd(), 'temp');
if (!fs.existsSync(customTemp)) fs.mkdirSync(customTemp, { recursive: true });
process.env.TMPDIR = customTemp;
process.env.TEMP = customTemp;
process.env.TMP = customTemp;

setInterval(() => {
    fs.readdir(customTemp, (err, files) => {
        if (err) return;
        for (const file of files) {
            const filePath = path.join(customTemp, file);
            fs.stat(filePath, (statErr, stats) => {
                if (!statErr && Date.now() - stats.mtimeMs > 3 * 60 * 60 * 1000) fs.unlink(filePath, () => {});
            });
        }
    });
}, 3 * 60 * 60 * 1000).unref();

const settings = require('./settings');
const { t } = require('./lib/i18n');
global.t = t;
const { installProcessHandlers } = require('./lib/errors/handler');
installProcessHandlers();
require('./config.js');

global.packname = settings.packname;
global.author = settings.author;
global.channelLink = settings.channelLink;
global.ytch = settings.developerName;

module.exports = require('./events');
