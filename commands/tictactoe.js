const TicTacToe = require('../lib/tictactoe');

// Store games globally
const games = {};
const economySystem = require('../systems/economy');
const currency = require('../systems/economy/currency');
const economyMessages = require('../systems/economy/messages');
const interaction = require('../systems/interaction');
const economy = economySystem.createEconomy();
const COST = economy.cost('tictactoe');
const REWARD = economy.rewardAmount('tictactoe');

async function tictactoeCommand(sock, chatId, senderId, text) {
    try {
    const normalizedText = String(text || '').trim().toLowerCase();
    if (['cancel','الغاء','إلغاء','الغاء_اللعبة','إلغاء_اللعبة'].includes(normalizedText)) {
        const waiting = Object.values(games).find(room => room.state === 'WAITING' && room.game?.playerX === senderId);
        if (!waiting) return sock.sendMessage(chatId, { text: '❌ لا توجد لعبة إكس-أو معلقة لإلغائها.' });
        delete games[waiting.id];
        await economy.reward(senderId, COST, 'game:refund:tictactoe');
        return sock.sendMessage(chatId, { text: '✅ تم إلغاء انتظار لعبة إكس-أو.' });
    }
        // Check if player is already in a game
        if (Object.values(games).find(room => 
            room.id.startsWith('tictactoe') && 
            [room.game.playerX, room.game.playerO].includes(senderId)
        )) {
            await sock.sendMessage(chatId, { 
                text: '❌ أنت داخل لعبة بالفعل. اكتب *استسلام* بالرد على رسالة اللعبة للانسحاب.' 
            });
            return;
        }

        // Look for existing room
        let room = Object.values(games).find(room => 
            room.state === 'WAITING' && 
            (text ? room.name === text : true)
        );

        if (room) {
            const charged = await economy.charge(senderId, COST, 'game:tictactoe');
            if (!charged.ok) return sock.sendMessage(chatId, { text: `💸 لا تملك ما يكفي من ${currency.name} للانضمام. تحتاج *${currency.amount(COST)}*.` });
            room.paidO = COST;
            // Join existing room
            room.o = chatId;
            room.game.playerO = senderId;
            room.state = 'PLAYING';

            const arr = room.game.render().map(v => ({
                'X': '❎',
                'O': '⭕',
                '1': '1️⃣',
                '2': '2️⃣',
                '3': '3️⃣',
                '4': '4️⃣',
                '5': '5️⃣',
                '6': '6️⃣',
                '7': '7️⃣',
                '8': '8️⃣',
                '9': '9️⃣',
            }[v]));

            const str = `
🎮 *بدأت لعبة إكس-أو!*

بانتظار @${room.game.currentTurn.split('@')[0]} للعب...

${arr.slice(0, 3).join('')}
${arr.slice(3, 6).join('')}
${arr.slice(6).join('')}

▢ *معرّف الغرفة:* ${room.id}
▢ *القواعد:*
• كوّن ثلاثة رموز متتالية أفقيًا أو عموديًا أو قطريًا للفوز
• اكتب رقمًا من 1 إلى 9 لوضع رمزك
• اكتب *استسلام* بالرد على رسالة اللعبة للانسحاب
`;

            // Send message only once to the group
            const sent = await sock.sendMessage(chatId, { 
                text: str,
                mentions: [room.game.currentTurn, room.game.playerX, room.game.playerO]
            });
            room.activeMessageIds = { [chatId]: sent?.key?.id || null };
            games[room.id] = room;

        } else {
            const charged = await economy.charge(senderId, COST, 'game:tictactoe');
            if (!charged.ok) return sock.sendMessage(chatId, { text: `💸 لا تملك ما يكفي من ${currency.name} لبدء اللعبة. تحتاج *${currency.amount(COST)}*.` });
            // Create new room
            room = {
                id: 'tictactoe-' + (+new Date),
                x: chatId,
                o: '',
                game: new TicTacToe(senderId, 'o'),
                state: 'WAITING', paidX: COST
            };

            if (text) room.name = text;

            const sent = await sock.sendMessage(chatId, { 
                text: '⏳ *في انتظار لاعب آخر*\nاكتب `.اكس او` للانضمام.\nللإلغاء: `.اكس او الغاء`'
            });
            room.activeMessageIds = { [chatId]: sent?.key?.id || null };
            games[room.id] = room;
        }

    } catch (error) {
        console.error('Error in tictactoe command:', error);
        await sock.sendMessage(chatId, { 
            text: '❌ تعذر بدء اللعبة. حاول مرة أخرى.' 
        });
    }
}

async function handleTicTacToeMove(sock, chatId, senderId, text, message = null) {
    try {
        // Find player's game
        const room = Object.values(games).find(room => 
            room.id.startsWith('tictactoe') && 
            [room.game.playerX, room.game.playerO].includes(senderId) && 
            room.state === 'PLAYING'
        );

        if (!room) return;
        if (message) {
            const activeId = room.activeMessageIds?.[chatId] || room.activeMessageId || null;
            if (activeId && !interaction.isReplyTo(message, activeId)) return;
        }

        const isSurrender = /^(استسلام|give up)$/i.test(String(text || '').trim());
        
        if (!isSurrender && !/^[1-9]$/.test(text)) return;

        // Allow استسلام at any time, not just during player's turn
        if (senderId !== room.game.currentTurn && !isSurrender) {
            await sock.sendMessage(chatId, { 
                text: '❌ ليس دورك الآن.' 
            });
            return;
        }

        let ok = isSurrender ? true : room.game.turn(
            senderId === room.game.playerO,
            parseInt(text) - 1
        );

        if (!ok) {
            await sock.sendMessage(chatId, { 
                text: '❌ هذه الخانة غير متاحة. اختر خانة أخرى.' 
            });
            return;
        }

        let winner = room.game.winner;
        let isTie = room.game.turns === 9;

        const arr = room.game.render().map(v => ({
            'X': '❎',
            'O': '⭕',
            '1': '1️⃣',
            '2': '2️⃣',
            '3': '3️⃣',
            '4': '4️⃣',
            '5': '5️⃣',
            '6': '6️⃣',
            '7': '7️⃣',
            '8': '8️⃣',
            '9': '9️⃣',
        }[v]));

        if (isSurrender) {
            // Set the winner to the opponent of the استسلامing player
            winner = senderId === room.game.playerX ? room.game.playerO : room.game.playerX;
            
            // Send a استسلام message
            await sock.sendMessage(chatId, { 
                text: `🏳️ @${senderId.split('@')[0]} انسحب! @${winner.split('@')[0]} فاز باللعبة!`,
                mentions: [senderId, winner]
            });
            
            const rewardBalance = await economy.reward(winner, REWARD, 'game:reward:tictactoe');
            await sock.sendMessage(chatId, { text: economyMessages.reward(REWARD, rewardBalance) });
            delete games[room.id];
            return;
        }

        let gameStatus;
        if (winner) {
            gameStatus = `🎉 @${winner.split('@')[0]} فاز باللعبة!`;
        } else if (isTie) {
            gameStatus = `🤝 انتهت اللعبة بالتعادل!`;
        } else {
            gameStatus = `🎲 الدور: @${room.game.currentTurn.split('@')[0]} (${senderId === room.game.playerX ? '❎' : '⭕'})`;
        }

        const str = `
🎮 *لعبة إكس-أو*

${gameStatus}

${arr.slice(0, 3).join('')}
${arr.slice(3, 6).join('')}
${arr.slice(6).join('')}

▢ اللاعب ❎: @${room.game.playerX.split('@')[0]}
▢ اللاعب ⭕: @${room.game.playerO.split('@')[0]}

${!winner && !isTie ? '• اكتب رقمًا من 1 إلى 9 للحركة\n• اكتب *استسلام* بالرد على رسالة اللعبة للانسحاب' : ''}
`;

        const mentions = [
            room.game.playerX, 
            room.game.playerO,
            ...(winner ? [winner] : [room.game.currentTurn])
        ];

        const sentX = await sock.sendMessage(room.x, { 
            text: str,
            mentions: mentions
        });
        room.activeMessageIds ||= {};
        room.activeMessageIds[room.x] = sentX?.key?.id || room.activeMessageIds[room.x] || null;

        if (room.x !== room.o) {
            const sentO = await sock.sendMessage(room.o, { 
                text: str,
                mentions: mentions
            });
            room.activeMessageIds ||= {};
            room.activeMessageIds[room.o] = sentO?.key?.id || room.activeMessageIds[room.o] || null;
        }

        if (winner || isTie) {
            if (winner) {
                const rewardBalance = await economy.reward(winner, REWARD, 'game:reward:tictactoe');
                await sock.sendMessage(room.x, { text: economyMessages.reward(REWARD, rewardBalance), mentions: [winner] });
            } else {
                await economy.reward(room.game.playerX, COST, 'game:refund:tictactoe');
                await economy.reward(room.game.playerO, COST, 'game:refund:tictactoe');
                await sock.sendMessage(room.x, { text: '🤝 تعادل! تم استرداد رسوم المشاركة للاعبين.' });
            }
            delete games[room.id];
        }

    } catch (error) {
        console.error('Error in tictactoe move:', error);
    }
}

module.exports = {
    tictactoeCommand,
    handleTicTacToeMove
};
