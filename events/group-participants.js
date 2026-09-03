'use strict';

const jsonStore = require('../lib/storage');
const { isBotEnabled, isGroupApproved, markGroupPending, notifyOwnerGroupAdded, sendPendingGroupWelcome } = require('../lib/access-control');
const { handlePromotionEvent } = require('../commands/promote');
const { handleDemotionEvent } = require('../commands/demote');
const { handleJoinEvent } = require('../commands/welcome');
const { handleLeaveEvent } = require('../commands/goodbye');

async function handleGroupParticipantUpdate(sock, update) {
    try {
        const { id, participants, action, author } = update;

        // Check if it's a group
        if (!id.endsWith('@g.us')) return;

        // Respect bot mode: only announce promote/demote in public mode
        let isPublic = true;
        try {
            const modeData = jsonStore.read('bot-mode', { isPublic: true });
            if (typeof modeData.isPublic === 'boolean') isPublic = modeData.isPublic;
        } catch (e) {
            // If reading fails, default to public behavior
        }

        // The add event must be handled before the approval gate so the owner gets notified.
        if (action === 'add') {
            const botIds = [sock.user?.id, sock.user?.lid, `${String(sock.user?.id || '').split(':')[0]}@s.whatsapp.net`].filter(Boolean);
            const botAdded = (participants || []).some(p => {
                const pid = typeof p === 'string' ? p : (p?.id || p?.lid || p?.phoneNumber || '');
                return botIds.some(b => b === pid || String(b).split(':')[0].split('@')[0] === String(pid).split(':')[0].split('@')[0]);
            });
            if (botAdded) {
                let metadata = null; try { metadata = await sock.groupMetadata(id); } catch {}
                const admins = (metadata?.participants || []).filter(p => p?.admin).map(p => p?.id || p?.lid || p?.phoneNumber).filter(Boolean);
                markGroupPending(id, { subject: metadata?.subject || '', addedBy: author || '', admins });
                await sendPendingGroupWelcome(sock, id, author);
                await notifyOwnerGroupAdded(sock, id, author);
                return;
            }
        }
        if (!isBotEnabled() || !isGroupApproved(id)) return;

        // Handle promotion events
        if (action === 'promote') {
            if (!isPublic) return;
            await handlePromotionEvent(sock, id, participants, author);
            return;
        }

        // Handle demotion events
        if (action === 'demote') {
            if (!isPublic) return;
            await handleDemotionEvent(sock, id, participants, author);
            return;
        }

        // Handle join events
        if (action === 'add') await handleJoinEvent(sock, id, participants);

        // Handle leave events
        if (action === 'remove') {
            await handleLeaveEvent(sock, id, participants);
        }
    } catch (error) {
        console.error('Error in handleGroupParticipantUpdate:', error);
    }
}

module.exports = { handleGroupParticipantUpdate };
