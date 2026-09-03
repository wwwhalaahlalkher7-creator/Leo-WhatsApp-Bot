'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Small, single-process JSON store.
 *
 * Guarantees:
 * - atomic temp-file + rename writes
 * - serialized async writes per file
 * - sync writes invalidate/cancel stale queued async writes
 * - path traversal is rejected
 * - malformed JSON is treated as corruption, never silently replaced
 */
class JsonStore {
  constructor(baseDir = path.join(process.cwd(), 'data')) {
    this.baseDir = path.resolve(baseDir);
    this.cache = new Map();
    this.writeQueues = new Map();
    this.revisions = new Map();
    fs.mkdirSync(this.baseDir, { recursive: true });
  }

  resolve(name) {
    const raw = String(name || '').trim();
    if (!raw) throw new Error('Storage file name is required');
    const fileName = raw.endsWith('.json') ? raw : `${raw}.json`;
    const file = path.resolve(this.baseDir, fileName);
    if (file !== this.baseDir && !file.startsWith(`${this.baseDir}${path.sep}`)) {
      throw new Error(`Invalid storage path: ${raw}`);
    }
    return file;
  }

  clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  _revision(file) { return this.revisions.get(file) || 0; }
  _bumpRevision(file) {
    const next = this._revision(file) + 1;
    this.revisions.set(file, next);
    return next;
  }

  read(name, fallback = {}) {
    const file = this.resolve(name);
    if (this.cache.has(file)) return this.clone(this.cache.get(file));
    try {
      const raw = fs.readFileSync(file, 'utf8').trim();
      const value = raw ? JSON.parse(raw) : fallback;
      this.cache.set(file, value);
      return this.clone(value);
    } catch (error) {
      if (error.code === 'ENOENT') {
        this.cache.set(file, this.clone(fallback));
        return this.clone(fallback);
      }
      if (error instanceof SyntaxError) {
        this.cache.delete(file);
        throw new Error(`Corrupt JSON storage: ${path.relative(this.baseDir, file)}`);
      }
      throw error;
    }
  }

  _writeFileSync(file, value, suffix = 'sync') {
    const tmp = `${file}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.${suffix}.tmp`;
    const payload = JSON.stringify(value, null, 2);
    fs.writeFileSync(tmp, payload, 'utf8');
    try {
      fs.renameSync(tmp, file);
    } catch (error) {
      try { fs.rmSync(tmp, { force: true }); } catch {}
      throw error;
    }
  }

  writeSync(name, value) {
    const file = this.resolve(name);
    // Invalidate queued async operations. They will check this revision before
    // touching the filesystem, preventing a stale async write from overwriting
    // this synchronous state change.
    const revision = this._bumpRevision(file);
    this._writeFileSync(file, value, 'sync');
    this.cache.set(file, this.clone(value));
    return this.clone(value);
  }

  async write(name, value) {
    const file = this.resolve(name);
    const previous = this.writeQueues.get(file) || Promise.resolve();
    const operationRevision = this._revision(file);
    const operation = previous.catch(() => {}).then(async () => {
      if (this._revision(file) !== operationRevision) return this.read(name, {});
      const tmp = `${file}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.async.tmp`;
      const payload = JSON.stringify(value, null, 2);
      await fs.promises.writeFile(tmp, payload, 'utf8');
      if (this._revision(file) !== operationRevision) {
        await fs.promises.rm(tmp, { force: true }).catch(() => {});
        return this.read(name, {});
      }
      await fs.promises.rename(tmp, file);
      this.cache.set(file, this.clone(value));
      return this.clone(value);
    });
    this.writeQueues.set(file, operation);
    try { return await operation; } finally {
      if (this.writeQueues.get(file) === operation) this.writeQueues.delete(file);
    }
  }

  async update(name, updater, fallback = {}) {
    const file = this.resolve(name);
    const previous = this.writeQueues.get(file) || Promise.resolve();
    const operationRevision = this._revision(file);
    const operation = previous.catch(() => {}).then(async () => {
      if (this._revision(file) !== operationRevision) return this.read(name, fallback);
      const current = this.read(name, fallback);
      const next = await updater(this.clone(current));
      const value = next === undefined ? current : next;
      if (this._revision(file) !== operationRevision) return this.read(name, fallback);
      const tmp = `${file}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.update.tmp`;
      await fs.promises.writeFile(tmp, JSON.stringify(value, null, 2), 'utf8');
      if (this._revision(file) !== operationRevision) {
        await fs.promises.rm(tmp, { force: true }).catch(() => {});
        return this.read(name, fallback);
      }
      await fs.promises.rename(tmp, file);
      this.cache.set(file, this.clone(value));
      return this.clone(value);
    });
    this.writeQueues.set(file, operation);
    try { return await operation; } finally {
      if (this.writeQueues.get(file) === operation) this.writeQueues.delete(file);
    }
  }

  clear(name) { this.cache.delete(this.resolve(name)); }
  invalidateAll() { this.cache.clear(); }
}

module.exports = new JsonStore();
module.exports.JsonStore = JsonStore;
