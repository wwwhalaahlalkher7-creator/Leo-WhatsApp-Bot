const moderation = require('./systems/moderation');
const settings = require('./settings');

(async () => {
  const fakeSock = { user: { id: '99999999999:1@s.whatsapp.net', lid: '99999999999@lid' } };
  const owner = `${settings.ownerNumber}@s.whatsapp.net`;
  const participants = [
    { id: owner, phoneNumber: owner },
    { id: fakeSock.user.id },
    { id: '249000000000@s.whatsapp.net' },
  ];

  if (await moderation.protectionReason(fakeSock, '123@g.us', owner, participants) !== 'owner') throw new Error('owner protection failed');
  if (await moderation.protectionReason(fakeSock, '123@g.us', fakeSock.user.id, participants) !== 'bot') throw new Error('bot protection failed');
  if (await moderation.protectionReason(fakeSock, '123@g.us', '249000000000@s.whatsapp.net', participants) !== null) throw new Error('normal member incorrectly protected');

  console.log('Moderation protection regression test passed.');
})().catch(err => { console.error(err); process.exit(1); });
