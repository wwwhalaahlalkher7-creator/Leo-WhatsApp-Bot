const fs = require('fs')
const STORE_FILE = './baileys_store.json'

// Config: keep last 20 messages per chat (configurable) - More aggressive for lower RAM
let MAX_MESSAGES = 20
let dirty = false

// Try to read config from settings
try {
    const settings = require('../settings.js')
    if (settings.maxStoreMessages && typeof settings.maxStoreMessages === 'number') {
        MAX_MESSAGES = settings.maxStoreMessages
    }
} catch (e) {
    // Use default if settings not available
}

const store = {
    messages: {},
    contacts: {},
    chats: {},

    readFromFile(filePath = STORE_FILE) {
        try {
            if (fs.existsSync(filePath)) {
                const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
                if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid store root')
                this.contacts = data.contacts && typeof data.contacts === 'object' ? data.contacts : {}
                this.chats = data.chats && typeof data.chats === 'object' ? data.chats : {}
                this.messages = data.messages && typeof data.messages === 'object' ? data.messages : {}
                dirty = false
                
                // Clean up any existing data to match new format
                this.cleanupData()
            }
        } catch (e) {
            if (fs.existsSync(filePath)) {
                try {
                    const corruptPath = `${filePath}.corrupt.${Date.now()}`
                    fs.renameSync(filePath, corruptPath)
                    console.error(`⚠️ Store file was corrupt and was preserved as ${corruptPath}`)
                } catch (preserveError) {
                    console.error('⚠️ Failed to preserve corrupt store file:', preserveError.message)
                }
            }
            this.contacts = {}
            this.chats = {}
            this.messages = {}
            dirty = true
            console.warn('⚠️ Lightweight store reset after read failure:', e.message)
        }
    },

    writeToFile(filePath = STORE_FILE, force = false) {
        if (!dirty && !force) return false
        try {
            const data = JSON.stringify({
                contacts: this.contacts,
                chats: this.chats,
                messages: this.messages
            })
            const tmp = `${filePath}.${process.pid}.tmp`
            fs.writeFileSync(tmp, data, 'utf8')
            fs.renameSync(tmp, filePath)
            dirty = false
            return true
        } catch (e) {
            console.warn('Failed to write store file:', e.message)
            return false
        }
    },

    cleanupData() {
        // Convert old format messages to new format if needed
        let converted = false
        if (this.messages) {
            Object.keys(this.messages).forEach(jid => {
                if (typeof this.messages[jid] === 'object' && !Array.isArray(this.messages[jid])) {
                    // Old format - convert to new format
                    const messages = Object.values(this.messages[jid])
                    this.messages[jid] = messages.slice(-MAX_MESSAGES)
                    converted = true
                }
            })
        }
        if (converted) dirty = true
    },

    bind(ev) {
        ev.on('messages.upsert', ({ messages }) => {
            messages.forEach(msg => {
                if (!msg.key?.remoteJid) return
                const jid = msg.key.remoteJid
                this.messages[jid] = this.messages[jid] || []

                // push new message
                this.messages[jid].push(msg)
                dirty = true

                // trim old ones
                if (this.messages[jid].length > MAX_MESSAGES) {
                    this.messages[jid] = this.messages[jid].slice(-MAX_MESSAGES)
                }
            })
        })

        ev.on('contacts.update', (contacts) => {
            contacts.forEach(contact => {
                if (contact.id) {
                    dirty = true
                    this.contacts[contact.id] = {
                        id: contact.id,
                        name: contact.notify || contact.name || ''
                    }
                }
            })
        })

        ev.on('chats.set', (chats) => {
            this.chats = {}
            dirty = true
            chats.forEach(chat => {
                this.chats[chat.id] = { id: chat.id, subject: chat.subject || '' }
            })
        })
    },

    async loadMessage(jid, id) {
        return this.messages[jid]?.find(m => m.key.id === id) || null
    },

    // Get store statistics
    getStats() {
        let totalMessages = 0
        let totalContacts = Object.keys(this.contacts).length
        let totalChats = Object.keys(this.chats).length
        
        Object.values(this.messages).forEach(chatMessages => {
            if (Array.isArray(chatMessages)) {
                totalMessages += chatMessages.length
            }
        })
        
        return {
            messages: totalMessages,
            contacts: totalContacts,
            chats: totalChats,
            maxMessagesPerChat: MAX_MESSAGES
        }
    }
}

module.exports = store
