'use strict';
class CooldownManager {
  constructor({ now = () => Date.now() } = {}) { this.now = now; this.map = new Map(); }
  key(scope, id) { return `${scope}:${id}`; }
  check(scope, id) { const until = this.map.get(this.key(scope, id)) || 0; const remaining = Math.max(0, until - this.now()); return { ok: remaining === 0, remaining }; }
  set(scope, id, ms) { const value = Math.max(0, Number(ms) || 0); this.map.set(this.key(scope, id), this.now() + value); return value; }
  consume(scope, id, ms) {
    const result = this.check(scope, id);
    if (!result.ok) return result;
    const value = this.set(scope, id, ms);
    return { ok: true, remaining: 0, token: { key: this.key(scope, id), until: this.map.get(this.key(scope, id)) } , ms: value };
  }
  rollback(scope, id, token) {
    const key = this.key(scope, id);
    const current = this.map.get(key);
    if (!token || token.key !== key || current !== token.until) return false;
    this.map.delete(key);
    return true;
  }
  clear(scope, id) { this.map.delete(this.key(scope, id)); }
}
module.exports = { CooldownManager };
