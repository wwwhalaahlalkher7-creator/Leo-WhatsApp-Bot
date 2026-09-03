'use strict';

// Event surface: each WhatsApp event family owns one module. Keeping the
// registration surface here prevents index.js/main.js from knowing feature
// implementation details and makes future event wiring auditable in one place.
const { handleMessages } = require('./messages');
const { handleGroupParticipantUpdate } = require('./group-participants');
const { handleStatus } = require('./status');

module.exports = {
  handleMessages,
  handleGroupParticipantUpdate,
  handleStatus,
};
