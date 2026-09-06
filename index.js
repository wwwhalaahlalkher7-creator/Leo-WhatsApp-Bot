/**
 * Leo Bot - A WhatsApp Bot
 * Copyright (c) 2024 Leonardo
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 * 
 * Credits:
 * - Baileys Library by @adiwajshing
 * - Pair Code implementation inspired by TechGod143 & DGXEON
 */
require('./settings')
const { Boom } = require('@hapi/boom')
const fs = require('fs')
const chalk = require('chalk')
const FileType = require('file-type')
const path = require('path')
const axios = require('axios')
const { handleMessages, handleGroupParticipantUpdate, handleStatus } = require('./main');
const PhoneNumber = require('awesome-phonenumber')
const { imageToWebp, videoToWebp, writeExifImg, writeExifVid } = require('./lib/exif')
const { smsg, isUrl, generateMessageTag, getBuffer, getSizeMedia, fetch, await, sleep, reSize } = require('./lib/myfunc')
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    generateForwardMessageContent,
    prepareWAMessageMedia,
    generateWAMessageFromContent,
    generateMessageID,
    downloadContentFromMessage,
    jidDecode,
    proto,
    jidNormalizedUser,
    makeCacheableSignalKeyStore,
    delay
} = require("@whiskeysockets/baileys")
const NodeCache = require("node-cache")
// Using a lightweight persisted store instead of makeInMemoryStore (compat across versions)
const pino = require("pino")
const readline = require("readline")
const { parsePhoneNumber } = require("libphonenumber-js")
const { PHONENUMBER_MCC } = require('@whiskeysockets/baileys/lib/Utils/generics')
const { rmSync, existsSync } = require('fs')
const { join } = require('path')

// Import lightweight store
const store = require('./lib/lightweight_store')
const { logError, safeSend } = require('./lib/errors/handler')

// Initialize store
store.readFromFile()
const settings = require('./settings')
const { channelInfo } = require('./lib/messageConfig')
const { backup } = require('./lib/storage/backup')
setInterval(() => store.writeToFile(), settings.storeWriteInterval || 10000).unref()

// Persistent runtime data is never deleted automatically on startup.
if (true) {
    try { backup('startup') } catch (e) { logError('storage.backup.startup', e) }
}

// Memory optimization - Force garbage collection if available
setInterval(() => {
    if (global.gc) {
        global.gc()
        console.log('🧹 Garbage collection completed')
    }
}, 60_000) // every 1 minute

// Memory monitoring - Restart if RAM gets too high
let shuttingDown = false
let activeBot = null
let reconnectTimer = null
let reconnectInProgress = false
let conflictReconnectAttempts = 0
const MAX_CONFLICT_RECONNECTS = 3

const scheduleReconnect = (reason = 'connection closed', delayMs = 5000) => {
    if (shuttingDown || reconnectTimer || reconnectInProgress) return
    console.log(chalk.yellow(`🔄 Scheduling reconnect: ${reason}`))
    reconnectTimer = setTimeout(() => {
        reconnectTimer = null
        reconnectInProgress = true
        startLeoBot()
            .catch(err => logError('bot.reconnect', err))
            .finally(() => { reconnectInProgress = false })
    }, Math.max(1000, Number(delayMs) || 5000))
}

const shutdown = async (reason = 'shutdown', exitCode = 0) => {
    if (shuttingDown) return
    shuttingDown = true
    console.log(chalk.yellow(`🛑 Shutting down Leo Bot: ${reason}`))
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null }
    try { await store.writeToFile('./baileys_store.json', true) } catch (e) { logError('shutdown.store', e) }
    try {
        if (activeBot && typeof activeBot.end === 'function') activeBot.end(new Error(reason))
    } catch (e) { logError('shutdown.socket', e) }
    if (rl) { try { rl.close() } catch {} }
    if (exitCode !== null) setTimeout(() => process.exit(exitCode), 250)
}

// Memory safety: let the hosting supervisor restart a cleanly stopped process.
setInterval(() => {
    const used = process.memoryUsage().rss / 1024 / 1024
    const limit = 400
    if (used > limit && !shuttingDown) {
        console.log(`⚠️ RAM too high (${used.toFixed(0)}MB > ${limit}MB), restarting safely...`)
        shutdown(`memory limit exceeded (${used.toFixed(0)}MB)`, 1)
    }
}, 30_000).unref()

let phoneNumber = settings.botNumber || ""
const dataStore = require('./lib/storage')
let owner = dataStore.read('owner.json', [])

global.botname = settings.botName
global.botDisplayName = settings.displayName
global.themeemoji = "•"
const pairingCode = process.argv.includes("--pairing-code") || process.env.PAIRING_CODE === "true"
const useMobile = process.argv.includes("--mobile")

// Only create readline interface if we're in an interactive environment
const rl = process.stdin.isTTY ? readline.createInterface({ input: process.stdin, output: process.stdout }) : null
const question = (text) => {
    if (rl) {
        return new Promise((resolve) => rl.question(text, resolve))
    } else {
        // In non-interactive environment, use botNumber from settings
        return Promise.resolve(settings.botNumber || phoneNumber)
    }
}


async function startLeoBot() {
    try {
        let { version, isLatest } = await fetchLatestBaileysVersion()
        const { state, saveCreds } = await useMultiFileAuthState(`./session`)
        const msgRetryCounterCache = new NodeCache()

        const LeoBot = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            printQRInTerminal: !pairingCode,
            browser: ["Ubuntu", "Chrome", "20.0.04"],
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
            },
            markOnlineOnConnect: true,
            generateHighQualityLinkPreview: true,
            syncFullHistory: false,
            getMessage: async (key) => {
                let jid = jidNormalizedUser(key.remoteJid)
                let msg = await store.loadMessage(jid, key.id)
                return msg?.message || ""
            },
            msgRetryCounterCache,
            defaultQueryTimeoutMs: 60000,
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 10000,
        })

        // Save credentials when they update
        LeoBot.ev.on('creds.update', saveCreds)
        activeBot = LeoBot

    store.bind(LeoBot.ev)

    // Message handling
    LeoBot.ev.on('messages.upsert', async chatUpdate => {
        try {
            const mek = chatUpdate.messages[0]
            if (!mek.message) return
            mek.message = (Object.keys(mek.message)[0] === 'ephemeralMessage') ? mek.message.ephemeralMessage.message : mek.message
            if (mek.key && mek.key.remoteJid === 'status@broadcast') {
                await handleStatus(LeoBot, chatUpdate);
                return;
            }
            // In private mode, only block non-group messages (allow groups for moderation)
            // Note: LeoBot.public is not synced, so we check mode in main.js instead
            // This check is kept for backward compatibility but mainly blocks DMs
            if (!LeoBot.public && !mek.key.fromMe && chatUpdate.type === 'notify') {
                const isGroup = mek.key?.remoteJid?.endsWith('@g.us')
                if (!isGroup) return // Block DMs in private mode, but allow group messages
            }
            if (mek.key.id.startsWith('BAE5') && mek.key.id.length === 16) return

            try {
                await handleMessages(LeoBot, chatUpdate, true)
            } catch (err) {
                logError('messages.handle', err, { chatId: mek.key?.remoteJid, messageId: mek.key?.id });
                await safeSend(LeoBot, mek.key?.remoteJid, { text: '❌ حدث خطأ أثناء معالجة الرسالة.', ...channelInfo });
            }
        } catch (err) {
            logError('messages.upsert', err, { chatId: mek?.key?.remoteJid, messageId: mek?.key?.id })
        }
    })

    // Add these event handlers for better functionality
    LeoBot.decodeJid = (jid) => {
        if (!jid) return jid
        if (/:\d+@/gi.test(jid)) {
            let decode = jidDecode(jid) || {}
            return decode.user && decode.server && decode.user + '@' + decode.server || jid
        } else return jid
    }

    LeoBot.ev.on('contacts.update', update => {
        for (let contact of update) {
            let id = LeoBot.decodeJid(contact.id)
            if (store && store.contacts) store.contacts[id] = { id, name: contact.notify }
        }
    })

    LeoBot.getName = (jid, withoutContact = false) => {
        const id = LeoBot.decodeJid(jid)
        withoutContact = LeoBot.withoutContact || withoutContact
        let v
        if (id.endsWith("@g.us")) return new Promise(async (resolve) => {
            v = store.contacts[id] || {}
            if (!(v.name || v.subject)) v = LeoBot.groupMetadata(id) || {}
            resolve(v.name || v.subject || PhoneNumber('+' + id.replace('@s.whatsapp.net', '')).getNumber('international'))
        })
        else v = id === '0@s.whatsapp.net' ? {
            id,
            name: 'WhatsApp'
        } : id === LeoBot.decodeJid(LeoBot.user.id) ?
            LeoBot.user :
            (store.contacts[id] || {})
        return (withoutContact ? '' : v.name) || v.subject || v.verifiedName || PhoneNumber('+' + jid.replace('@s.whatsapp.net', '')).getNumber('international')
    }

    LeoBot.public = true

    LeoBot.serializeM = (m) => smsg(LeoBot, m, store)

    // Handle pairing code
    if (pairingCode && !state.creds.registered) {
        if (useMobile) throw new Error('Cannot use pairing code with mobile api')

        let phoneNumber
        if (!!global.phoneNumber) {
            phoneNumber = global.phoneNumber
        } else {
            phoneNumber = await question(chalk.bgBlack(chalk.greenBright(`Please type your WhatsApp number 😍\nFormat: 6281376552730 (without + or spaces) : `)))
        }

        // Clean the phone number - remove any non-digit characters
        phoneNumber = phoneNumber.replace(/[^0-9]/g, '')

        // Validate the phone number using awesome-phonenumber
        const pn = require('awesome-phonenumber');
        if (!pn('+' + phoneNumber).isValid()) {
            console.log(chalk.red('Invalid phone number. Please enter your full international number (e.g., 15551234567 for US, 447911123456 for UK, etc.) without + or spaces.'));
            process.exit(1);
        }

        setTimeout(async () => {
            if (shuttingDown || activeBot !== LeoBot || !state.creds || state.creds.registered) {
                console.log(chalk.yellow('⚠️ Pairing cancelled because the bot connection is no longer available.'))
                return
            }

            try {
                let code = await LeoBot.requestPairingCode(phoneNumber)
                code = code?.match(/.{1,4}/g)?.join("-") || code
                console.log(chalk.black(chalk.bgGreen(`Your Pairing Code : `)), chalk.black(chalk.white(code)))
                console.log(chalk.yellow(`\nPlease enter this code in your WhatsApp app:\n1. Open WhatsApp\n2. Go to Settings > Linked Devices\n3. Tap "Link a Device"\n4. Enter the code shown above`))
            } catch (error) {
                console.error('Error requesting pairing code:', error)
                console.log(chalk.red('Failed to get pairing code. Please check your phone number and try again.'))
            }
        }, 5000)
    }

    // Connection handling
    LeoBot.ev.on('connection.update', async (s) => {
        const { connection, lastDisconnect, qr } = s
        
        if (qr) {
            console.log(chalk.yellow('📱 QR Code generated. Please scan with WhatsApp.'))
        }
        
        if (connection === 'connecting') {
            console.log(chalk.yellow('🔄 Connecting to WhatsApp...'))
        }
        
        if (connection == "open") {
            conflictReconnectAttempts = 0
            console.log(chalk.magenta(` `))
            console.log(chalk.yellow(`🌿Connected to => ` + JSON.stringify(LeoBot.user, null, 2)))

            try {
                const botNumber = LeoBot.user.id.split(':')[0] + '@s.whatsapp.net';
                const { ownerJid, getGroupStats, notifyOwnerPendingGroups, markCurrentGroupsPending } = require('./lib/access-control');
                let groupCount = 0; let pendingGroups = [];
                try {
                    const groups = await LeoBot.groupFetchAllParticipating();
                    const groupIds = Object.keys(groups || {});
                    groupCount = groupIds.length;
                    if (didFreshStart) markCurrentGroupsPending(groupIds);
                    pendingGroups = getGroupStats(groupIds).pending;
                } catch (_) {
                    const stats = getGroupStats();
                    groupCount = stats.total;
                    pendingGroups = stats.pending;
                }
                const ownerText = `🤖 ${settings.displayName} جاهز!\n\n⏰ الوقت: ${new Date().toLocaleString('ar-EG')}\n✅ الحالة: متصل وجاهز للعمل.\n👥 عدد المجموعات: *${groupCount}*\n${pendingGroups.length ? `⛔ مجموعات بانتظار الموافقة: *${pendingGroups.length}*` : '✅ لا توجد مجموعات بانتظار الموافقة.'}`;
                const ownerTarget = ownerJid() || botNumber;
                await LeoBot.sendMessage(ownerTarget, { text: ownerText });
                if (pendingGroups.length) await notifyOwnerPendingGroups(LeoBot, pendingGroups);
            } catch (error) {
                console.error('Error sending connection message:', error.message)
            }

            await delay(1999)
            console.log(chalk.yellow(`\n\n                  ${chalk.bold.blue(`[ ${global.botname || 'LEO BOT'} ]`)}\n\n`))
            console.log(chalk.cyan(`< ================================================== >`))
            console.log(chalk.magenta(`${global.themeemoji || '•'} WA NUMBER: ${owner}`))
            console.log(chalk.magenta(`${global.themeemoji || '•'} COPYRIGHT: ${settings.copyright}`))
            console.log(chalk.green(`${global.themeemoji || '•'} 🤖 Bot Connected Successfully! ✅`))
            console.log(chalk.blue(`Bot Version: ${settings.version}`))
        }
        
        if (connection === 'close') {
            if (activeBot === LeoBot) activeBot = null

            const error = lastDisconnect?.error
            const statusCode = error?.output?.statusCode
            const errorData = error?.data
            const conflictType = errorData?.tag === 'conflict' ? errorData?.attrs?.type : undefined
            const isDeviceRemovedConflict = statusCode === 401 && conflictType === 'device_removed'
            const isLoggedOut = statusCode === DisconnectReason.loggedOut && !isDeviceRemovedConflict

            console.log(chalk.red(`Connection closed due to ${error}, status=${statusCode ?? 'unknown'}, conflict=${conflictType ?? 'none'}`))

            // Baileys 7 RC9 has documented 401/conflict/device_removed disconnects that
            // can occur after minutes or hours even when the session was not deliberately
            // removed. Never destroy the saved session on this specific signal.
            if (isDeviceRemovedConflict) {
                conflictReconnectAttempts += 1
                if (conflictReconnectAttempts <= MAX_CONFLICT_RECONNECTS) {
                    const delayMs = 15000
                    console.log(chalk.yellow(`⚠️ WhatsApp conflict/device_removed (${conflictReconnectAttempts}/${MAX_CONFLICT_RECONNECTS}). Preserving session and retrying in ${delayMs}ms.`))
                    scheduleReconnect(`WhatsApp conflict/device_removed`, delayMs)
                } else {
                    console.log(chalk.red(`❌ Repeated conflict/device_removed reached ${MAX_CONFLICT_RECONNECTS} attempts. Session preserved; manual inspection/re-authentication may be required.`))
                    await shutdown('repeated WhatsApp conflict', null)
                }
                return
            }

            if (isLoggedOut || statusCode === 401) {
                try {
                    rmSync('./session', { recursive: true, force: true })
                    console.log(chalk.yellow('Session folder deleted. Please re-authenticate.'))
                } catch (deleteError) {
                    console.error('Error deleting session:', deleteError)
                }
                console.log(chalk.red('Session logged out. Please re-authenticate.'))
                console.log(chalk.red('❌ Logged out. Automatic reconnect disabled until re-authentication.'))
                await shutdown('logged out', null)
                return
            }

            scheduleReconnect(`WhatsApp disconnect (${statusCode ?? 'unknown'})`)
        }
    })

    LeoBot.ev.on('group-participants.update', async (update) => {
        try {
            await handleGroupParticipantUpdate(LeoBot, update)
        } catch (err) {
            logError('group-participants.update', err)
        }
    })

    LeoBot.ev.on('status.update', async (status) => {
        try {
            await handleStatus(LeoBot, status)
        } catch (err) {
            logError('status.update', err)
        }
    })

    LeoBot.ev.on('messages.reaction', async (status) => {
        try {
            await handleStatus(LeoBot, status)
        } catch (err) {
            logError('messages.reaction', err)
        }
    })

    return LeoBot
    } catch (error) {
        console.error('Error in startLeoBot:', error)
        scheduleReconnect('startup failure')
        throw error
    }
}


// Process lifecycle: one socket at a time; the hosting supervisor handles restarts.
process.on('SIGINT', () => shutdown('SIGINT', 0))
process.on('SIGTERM', () => shutdown('SIGTERM', 0))

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err)
    shutdown('uncaught exception', 1)
})

process.on('unhandledRejection', (err) => {
    console.error('Unhandled Rejection:', err)
    // Do not create another socket here; leave restart decisions to the supervisor.
})

startLeoBot().catch(error => {
    console.error('Initial bot start failed:', error)
    scheduleReconnect('initial startup failure')
})
