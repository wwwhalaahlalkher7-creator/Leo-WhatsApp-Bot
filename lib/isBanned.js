const store = require('./storage');

function isBanned(userId) {
    try {
        const bannedUsers = store.read('banned', []);
        return bannedUsers.includes(userId);
    } catch (error) {
        console.error('Error checking banned status:', error);
        return false;
    }
}

module.exports = { isBanned }; 