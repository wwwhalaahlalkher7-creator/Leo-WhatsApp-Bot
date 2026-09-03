'use strict';

class SessionManager {
  constructor({ now = () => Date.now(), defaultTtl = 10 * 60 * 1000 } = {}) {
    this.sessions = new Map();
    this.now = now;
    this.defaultTtl = defaultTtl;
  }
  _key(type, chatId, ownerId) { return `${type}:${chatId}:${ownerId}`; }
  create({ type, chatId, ownerId, activeMessageId = null, ttl = this.defaultTtl, state = 'active', data = {}, onClose = null }) {
    if (!type || !chatId || !ownerId) throw new Error('Session requires type, chatId and ownerId');
    const now = this.now();
    const session = { id: `${type}:${chatId}:${ownerId}:${now}`, type, chatId, ownerId, activeMessageId, createdAt: now, updatedAt: now, expiresAt: ttl > 0 ? now + ttl : null, state, data: { ...data }, onClose: typeof onClose === 'function' ? onClose : null };
    this.sessions.set(this._key(type, chatId, ownerId), session);
    return session;
  }
  get(type, chatId, ownerId) {
    const key = this._key(type, chatId, ownerId);
    const session = this.sessions.get(key);
    if (!session) return null;

    // Expire lazily on access. Keep get() safe even if no session exists.
    if (session.expiresAt && this.now() >= session.expiresAt) {
      this.close(session, 'expired');
      return null;
    }

    return session;
  }
  findByMessage(type, chatId, messageId) {
    this.cleanup();
    for (const s of this.sessions.values()) if (s.type === type && s.chatId === chatId && s.activeMessageId === messageId && s.state === 'active') return s;
    return null;
  }
  authorize(session, { chatId, ownerId, messageId = null } = {}) {
    if (!session || session.state !== 'active') return { ok: false, reason: 'inactive' };
    if (chatId != null && session.chatId !== chatId) return { ok: false, reason: 'wrong_chat' };
    if (ownerId != null && session.ownerId !== ownerId) return { ok: false, reason: 'wrong_user' };
    if (messageId != null && session.activeMessageId !== messageId) return { ok: false, reason: 'wrong_message' };
    if (session.expiresAt && this.now() >= session.expiresAt) { this.close(session, 'expired'); return { ok: false, reason: 'expired' }; }
    return { ok: true };
  }
  touch(session, patch = {}) { Object.assign(session, patch, { updatedAt: this.now() }); return session; }
  setActiveMessage(session, messageId) { return this.touch(session, { activeMessageId: messageId }); }
  close(session, reason = 'closed') { if (!session) return false; session.state = 'closed'; session.closeReason = reason; session.updatedAt = this.now(); this.sessions.delete(this._key(session.type, session.chatId, session.ownerId)); if (session.onClose) { try { session.onClose(session, reason); } catch (error) { console.error('[SESSION onClose]', error?.message || error); } } return true; }
  cleanup() { const now = this.now(); for (const s of [...this.sessions.values()]) if (s.expiresAt && now >= s.expiresAt) this.close(s, 'expired'); }
  size() { this.cleanup(); return this.sessions.size; }
}

module.exports = { SessionManager };
