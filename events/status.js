'use strict';

const { handleStatusUpdate } = require('../commands/autostatus');

async function handleStatus(sock, status) {
    await handleStatusUpdate(sock, status);
}

module.exports = { handleStatus };
