const settings = require('../settings');
const { isSudo } = require('./index');

const clean = (jid = '') => String(jid || '').split(':')[0].split('@')[0].replace(/[^0-9]/g, '');

async function isAdmin(sock, chatId, senderId, alternateSenderId = null) {
    try {
        const metadata = await sock.groupMetadata(chatId);
        const participants = metadata.participants || [];
        const ownerNumber = clean(settings.ownerNumber);

        const botId = sock.user?.id || '';
        const botLid = sock.user?.lid || '';
        const botNumber = clean(botId);
        const botLidNumber = clean(botLid);
        const senderCandidates = [senderId, alternateSenderId].filter(Boolean);
        const senderClean = clean(senderId);

        const matchesIdentity = (value, participant) => {
            const candidates = [participant?.id, participant?.lid, participant?.phoneNumber, participant?.phone_number].filter(Boolean);
            return candidates.some(id => String(id) === String(value) || clean(id) === clean(value));
        };

        const isBotAdmin = participants.some(p => {
            const matches = [botId, botLid, botNumber, botLidNumber].some(id => id && matchesIdentity(id, p));
            return matches && (p.admin === 'admin' || p.admin === 'superadmin');
        });

        // The configured owner/sudo is privileged even when WhatsApp does not mark
        // that participant as admin. This affects authorization only; WhatsApp still
        // requires the BOT account itself to be admin for destructive group actions.
        let isSenderAdmin = participants.some(p => {
            return senderCandidates.some(candidate => matchesIdentity(candidate, p)) && (p.admin === 'admin' || p.admin === 'superadmin');
        });

        if (!isSenderAdmin && ownerNumber && senderClean === ownerNumber) isSenderAdmin = true;

        if (!isSenderAdmin) {
            const ownerParticipant = participants.find(p => {
                return [p?.id, p?.lid, p?.phoneNumber, p?.phone_number].some(id => clean(id) === ownerNumber);
            });
            if (ownerParticipant && senderCandidates.some(candidate => matchesIdentity(candidate, ownerParticipant))) isSenderAdmin = true;
        }

        if (!isSenderAdmin) {
            try { isSenderAdmin = await isSudo(senderId) || (alternateSenderId ? await isSudo(alternateSenderId) : false); } catch {}
        }

        return { isSenderAdmin, isBotAdmin };
    } catch (err) {
        console.error('❌ Error in isAdmin:', err);
        return { isSenderAdmin: false, isBotAdmin: false };
    }
}

module.exports = isAdmin;
