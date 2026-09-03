function cleanId(id = '') {
  return String(id || '').split(':')[0].split('@')[0].replace(/[^0-9]/g, '');
}

function participantIds(participant = {}) {
  return [participant?.id, participant?.lid, participant?.phoneNumber, participant?.phone_number].filter(Boolean);
}

function sameParticipant(a, b) {
  const left = cleanId(a);
  const right = cleanId(b);
  return Boolean(left && right && left === right) || String(a || '') === String(b || '');
}

function findParticipant(participants, jid) {
  return (participants || []).find(p => participantIds(p).some(id => sameParticipant(id, jid))) || null;
}

function isAdminParticipant(participant) {
  return Boolean(participant?.admin === 'admin' || participant?.admin === 'superadmin' || participant?.admin === true);
}

module.exports = { cleanId, participantIds, sameParticipant, findParticipant, isAdminParticipant };
