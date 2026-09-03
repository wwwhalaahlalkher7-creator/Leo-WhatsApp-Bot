const { exec, execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const settings = require('../settings');
const isOwnerOrSudo = require('../lib/isOwner');

const UPDATE_MAX_BYTES = 50 * 1024 * 1024;
const UPDATE_ALLOWED_HOSTS = new Set(
    'github.com,codeload.github.com'
        .split(',').map(v => v.trim().toLowerCase()).filter(Boolean)
);

function validateUpdateUrl(rawUrl) {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:') throw new Error('مصدر التحديث يجب أن يستخدم HTTPS.');
    if (!UPDATE_ALLOWED_HOSTS.has(parsed.hostname.toLowerCase())) {
        throw new Error(`مضيف التحديث غير مسموح: ${parsed.hostname}`);
    }
    return parsed;
}

function validateZipEntries(zipPath) {
    return new Promise((resolve, reject) => {
        execFile('unzip', ['-Z1', zipPath], (err, stdout, stderr) => {
            if (err) return reject(new Error((stderr || err.message).trim()));
            for (const entry of String(stdout).split(/\r?\n/).filter(Boolean)) {
                const normalized = entry.replace(/\\/g, '/');
                if (normalized.startsWith('/') || normalized.split('/').includes('..')) {
                    return reject(new Error(`Unsafe ZIP entry rejected: ${entry}`));
                }
            }
            resolve();
        });
    });
}

function assertNoSymlinks(rootDir) {
    const walk = dir => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            const stat = fs.lstatSync(full);
            if (stat.isSymbolicLink()) throw new Error(`Symbolic link rejected in update archive: ${path.relative(rootDir, full)}`);
            if (stat.isDirectory()) walk(full);
        }
    };
    walk(rootDir);
}

function run(cmd) {
    return new Promise((resolve, reject) => {
        exec(cmd, { windowsHide: true }, (err, stdout, stderr) => {
            if (err) return reject(new Error((stderr || stdout || err.message || '').toString()));
            resolve((stdout || '').toString());
        });
    });
}

async function hasGitRepo() {
    const gitDir = path.join(process.cwd(), '.git');
    if (!fs.existsSync(gitDir)) return false;
    try {
        await run('git --version');
        return true;
    } catch {
        return false;
    }
}

async function updateViaGit() {
    const oldRev = (await run('git rev-parse HEAD').catch(() => 'unknown')).trim();
    await run('git fetch --all --prune');
    const newRev = (await run('git rev-parse origin/main')).trim();
    const alreadyUpToDate = oldRev === newRev;
    const commits = alreadyUpToDate ? '' : await run(`git log --pretty=format:"%h %s (%an)" ${oldRev}..${newRev}`).catch(() => '');
    const files = alreadyUpToDate ? '' : await run(`git diff --name-status ${oldRev} ${newRev}`).catch(() => '');
    // Fast-forward only: refuses to overwrite local tracked changes and never touches untracked/ignored runtime data.
    await run(`git merge --ff-only ${newRev}`);
    // Never run git clean/reset: runtime data and locally managed files must survive updates.
    return { oldRev, newRev, alreadyUpToDate, commits, files };
}

function downloadFile(rawUrl, dest, visited = new Set(), totalBytes = 0) {
    return new Promise((resolve, reject) => {
        let parsed;
        try { parsed = validateUpdateUrl(rawUrl); } catch (e) { return reject(e); }
        const url = parsed.toString();
        if (visited.has(url) || visited.size > 5) return reject(new Error('Too many redirects'));
        visited.add(url);

        const req = require('https').get(url, {
            headers: { 'User-Agent': 'Leo Bot-Updater/1.0', 'Accept': 'application/zip,application/octet-stream,*/*' }
        }, res => {
            if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
                const location = res.headers.location;
                res.resume();
                if (!location) return reject(new Error(`HTTPS ${res.statusCode} without Location`));
                return downloadFile(new URL(location, url).toString(), dest, visited, totalBytes).then(resolve).catch(reject);
            }
            if (res.statusCode !== 200) {
                res.resume();
                return reject(new Error(`HTTP ${res.statusCode}`));
            }
            const declared = Number.parseInt(res.headers['content-length'] || '0', 10);
            if (declared > UPDATE_MAX_BYTES) {
                res.resume();
                return reject(new Error(`Update archive exceeds ${UPDATE_MAX_BYTES} bytes.`));
            }
            let received = totalBytes;
            const file = fs.createWriteStream(dest);
            let settled = false;
            const fail = err => {
                if (settled) return;
                settled = true;
                res.destroy();
                file.destroy();
                fs.unlink(dest, () => reject(err));
            };
            res.on('data', chunk => {
                received += chunk.length;
                if (received > UPDATE_MAX_BYTES) fail(new Error(`Update archive exceeds ${UPDATE_MAX_BYTES} bytes.`));
            });
            res.on('error', fail);
            file.on('error', fail);
            file.on('finish', () => {
                if (settled) return;
                settled = true;
                file.close(resolve);
            });
            res.pipe(file);
        });
        req.setTimeout(30000, () => req.destroy(new Error('Update download timed out')));
        req.on('error', err => fs.unlink(dest, () => reject(err)));
    });
}
async function extractZip(zipPath, outDir) {
    // Try to use platform tools; no extra npm modules required
    if (process.platform === 'win32') {
        const cmd = `powershell -NoProfile -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${outDir.replace(/\\/g, '/')}' -Force"`;
        await run(cmd);
        return;
    }
    // Linux/mac: try unzip, else 7z, else busybox unzip
    try {
        await run('command -v unzip');
        await run(`unzip -o '${zipPath}' -d '${outDir}'`);
        return;
    } catch {}
    try {
        await run('command -v 7z');
        await run(`7z x -y '${zipPath}' -o'${outDir}'`);
        return;
    } catch {}
    try {
        await run('busybox unzip -h');
        await run(`busybox unzip -o '${zipPath}' -d '${outDir}'`);
        return;
    } catch {}
    throw new Error("No system unzip tool found (unzip/7z/busybox). Git mode is recommended on this panel.");
}

function copyRecursive(src, dest, ignore = [], relative = '', outList = []) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
        if (ignore.includes(entry)) continue;
        const s = path.join(src, entry);
        const d = path.join(dest, entry);
        const stat = fs.lstatSync(s);
        if (stat.isDirectory()) {
            copyRecursive(s, d, ignore, path.join(relative, entry), outList);
        } else {
            fs.copyFileSync(s, d);
            if (outList) outList.push(path.join(relative, entry).replace(/\\/g, '/'));
        }
    }
}

async function updateViaZip(sock, chatId, message, zipOverride) {
    const zipUrl = (zipOverride || settings.updateZipUrl || '').trim();
    if (!zipUrl) {
        throw new Error('لا يوجد رابط تحديث مضبوط. تم توفير رابط GitHub افتراضي؛ تحقق من UPDATE_ZIP_URL إذا كنت تستخدم مصدرًا مختلفًا.');
    }
    const tmpDir = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const zipPath = path.join(tmpDir, 'update.zip');
    await downloadFile(zipUrl, zipPath);
    await validateZipEntries(zipPath);
    const extractTo = path.join(tmpDir, 'update_extract');
    if (fs.existsSync(extractTo)) fs.rmSync(extractTo, { recursive: true, force: true });
    await extractZip(zipPath, extractTo);
    assertNoSymlinks(extractTo);

    // Find the top-level extracted folder (GitHub zips create REPO-branch folder)
    const [root] = fs.readdirSync(extractTo).map(n => path.join(extractTo, n));
    const srcRoot = fs.existsSync(root) && fs.lstatSync(root).isDirectory() ? root : extractTo;

    // Copy over while preserving runtime dirs/files
    const ignore = ['node_modules', '.git', 'session', 'tmp', 'tmp/', 'temp', 'data', 'baileys_store.json'];
    const copied = [];
    copyRecursive(srcRoot, process.cwd(), ignore, '', copied);
    // Secrets and owner identity are kept in .env and are never copied into source files.
    // Cleanup extracted directory
    try { fs.rmSync(extractTo, { recursive: true, force: true }); } catch {}
    try { fs.rmSync(zipPath, { force: true }); } catch {}
    return { copiedFiles: copied };
}

async function restartProcess(sock, chatId, message) {
    try {
        await sock.sendMessage(chatId, { text: '✅ اكتمل التحديث. جاري إعادة التشغيل…' }, { quoted: message });
    } catch {}
    try {
        // Preferred: PM2
        await run('pm2 restart all');
        return;
    } catch {}
    // Panels usually auto-restart when the process exits.
    // Exit after a short delay to allow the above message to flush.
    setTimeout(() => {
        process.exit(0);
    }, 500);
}

async function updateCommand(sock, chatId, message, zipOverride) {
    const senderId = message.key.participant || message.key.remoteJid;
    const isOwner = await isOwnerOrSudo(senderId, sock, chatId);
    
    if (!message.key.fromMe && !isOwner) {
        await sock.sendMessage(chatId, { text: '❌ أمر التحديث للمالك فقط.' }, { quoted: message });
        return;
    }
    try {
        // Minimal UX
        await sock.sendMessage(chatId, { text: '🔄 جاري تحديث LeoBot، انتظر قليلًا…' }, { quoted: message });
        if (await hasGitRepo()) {
            // silent
            const { oldRev, newRev, alreadyUpToDate, commits, files } = await updateViaGit();
            // Short message only: version info
            const summary = alreadyUpToDate ? `✅ LeoBot محدث بالفعل: ${newRev}` : `✅ تم التحديث إلى: ${newRev}`;
            console.log('[update] summary generated');
            // silent
            await run('npm install --no-audit --no-fund');
        } else {
            const { copiedFiles } = await updateViaZip(sock, chatId, message, zipOverride);
            // silent
        }
        try {
            const v = require('../settings').version || '';
            await sock.sendMessage(chatId, { text: `✅ تم التحديث بنجاح. جاري إعادة التشغيل…` }, { quoted: message });
        } catch {
            await sock.sendMessage(chatId, { text: '✅ تمت إعادة التشغيل بنجاح. استخدم `.بنغ` للتحقق من الإصدار.' }, { quoted: message });
        }
        await restartProcess(sock, chatId, message);
    } catch (err) {
        console.error('فشل التحديث:', err);
        await sock.sendMessage(chatId, { text: `❌ فشل التحديث:\n${String(err.message || err)}` }, { quoted: message });
    }
}

module.exports = updateCommand;


