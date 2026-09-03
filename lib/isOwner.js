const settings = require('../settings');
const { isSudo } = require('./index');

const clean = (jid = '') => String(jid || '').split(':')[0].split('@')[0].replace(/[^0-9]/g, '');

async function isOwnerOrSudo(senderId, sock = null, chatId = null, alternateSenderId = null) {
    const ownerNumberClean = clean(settings.ownerNumber);
    const ownerJid = `${ownerNumberClean}@s.whatsapp.net`;
    const candidates = [senderId, alternateSenderId].filter(Boolean);

    // Fast direct checks. Baileys v7 can expose the phone-number identity
    // as participantAlt while participant is a LID.
    for (const id of candidates) {
        const value = String(id);
        if (value === ownerJid || clean(value) === ownerNumberClean) return true;
    }

    // In groups, resolve the owner's LID <-> phone-number pair from metadata.
    // This is the reliable path when WhatsApp addresses the message by @lid.
    if (sock && chatId && chatId.endsWith('@g.us')) {
        try {
            const metadata = await sock.groupMetadata(chatId);
            const participants = metadata?.participants || [];

            const ownerParticipant = participants.find(p => {
                const pId = p?.id || '';
                const pPhone = p?.phoneNumber || p?.phone_number || '';
                return clean(pId) === ownerNumberClean || clean(pPhone) === ownerNumberClean;
            });

            if (ownerParticipant) {
                const ownerIds = [
                    ownerParticipant.id,
                    ownerParticipant.lid,
                    ownerParticipant.phoneNumber,
                    ownerParticipant.phone_number,
                ].filter(Boolean);

                for (const candidate of candidates) {
                    for (const ownerId of ownerIds) {
                        if (candidate === ownerId || clean(candidate) === clean(ownerId)) return true;
                    }
                }
            }

            // Also compare participantAlt directly against the configured owner.
            const senderIds = candidates;
            for (const p of participants) {
                const ids = [p?.id, p?.lid, p?.phoneNumber, p?.phone_number].filter(Boolean);
                const matchesSender = ids.some(id =>
                    senderIds.some(candidate => candidate === id || clean(candidate) === clean(id))
                );
                const matchesOwner = ids.some(id => clean(id) === ownerNumberClean);
                if (matchesSender && matchesOwner) return true;
            }
        } catch (e) {
            console.error('❌ [isOwner] Error checking group participant data:', e.message);
        }
    }

    // If Baileys exposes the LID mapping repository, use it.
    if (sock?.signalRepository?.lidMapping && candidates.length) {
        for (const candidate of candidates) {
            if (String(candidate).includes('@lid')) {
                try {
                    const pn = await sock.signalRepository.lidMapping.getPNForLID(candidate);
                    if (pn && clean(pn) === ownerNumberClean) return true;
                } catch {}
            }
        }
    }

    // Sudo remains an explicit secondary authorization mechanism.
    try {
        for (const candidate of candidates) {
            if (await isSudo(candidate)) return true;
        }
    } catch (e) {
        console.error('❌ [isOwner] Error checking sudo:', e.message);
    }

    return false;
}

module.exports = isOwnerOrSudo;
