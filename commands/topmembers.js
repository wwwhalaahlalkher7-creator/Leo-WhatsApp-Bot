const { t } = require('../lib/i18n');
const fs = require('fs');
const path = require('path');
const dataStore = require('../lib/storage');

const dataFilePath = 'message-counts.json';

function loadMessageCounts() {
    return dataStore.read(dataFilePath, {});
}

function saveMessageCounts(messageCounts) {
    dataStore.writeSync(dataFilePath, messageCounts);
}

function incrementMessageCount(groupId, userId) {
    const messageCounts = loadMessageCounts();

    if (!messageCounts[groupId]) {
        messageCounts[groupId] = {};
    }

    if (!messageCounts[groupId][userId]) {
        messageCounts[groupId][userId] = 0;
    }

    messageCounts[groupId][userId] += 1;

    saveMessageCounts(messageCounts);
}

function topMembers(sock, chatId, isGroup) {
    if (!isGroup) {
        sock.sendMessage(chatId, { text: t('common.onlyGroup') });
        return;
    }

    const messageCounts = loadMessageCounts();
    const groupCounts = messageCounts[chatId] || {};

    const sortedMembers = Object.entries(groupCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5); // Get top 5 members

    if (sortedMembers.length === 0) {
        sock.sendMessage(chatId, { text: 'لم يتم تسجيل نشاط رسائل حتى الآن.' });
        return;
    }

    let message = '🏆 أكثر الأعضاء نشاطًا حسب عدد الرسائل:\n\n';
    sortedMembers.forEach(([userId, count], index) => {
        message += `${index + 1}. @${userId.split('@')[0]} - ${count} رسالة\n`;
    });

    sock.sendMessage(chatId, { text: message, mentions: sortedMembers.map(([userId]) => userId) });
}

module.exports = { incrementMessageCount, topMembers };
