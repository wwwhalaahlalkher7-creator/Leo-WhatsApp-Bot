'use strict';

const { handleStatusUpdate } = require('../lib/internal/autostatus');

async function handleStatus(sock, status) {
    await handleStatusUpdate(sock, status);
}

module.exports = { handleStatus };
