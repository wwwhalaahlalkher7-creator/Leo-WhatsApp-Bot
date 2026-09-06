module.exports = {
  code: 'en', direction: 'ltr', name: 'English',
  common: {
    notSet:'Not set', noDescription:'No description',
    error:'❌ Something went wrong while executing the command.', rateLimit:'⏳ The service rate limit was reached. Try again shortly.',
    serviceUnavailable:'⚠️ The requested service is currently unavailable. Try later.', notAdmin:'❌ This command is available to group admins or the bot owner.',
    botMustBeAdmin:'❌ Please make the bot an admin first.', onlyGroup:'❌ This command is only available in group chats.',
    ownerOnly:'❌ This command is available to the owner or Sudo only.', ownerOnlyShort:'❌ Only the bot owner can use this command.',
    mentionUser:'📌 Mention the user or reply to their message first.', validMinutes:'⏱️ Provide a valid number of minutes, or use the command without a number for an immediate mute.',
    stickerReply:'🖼️ Reply to a sticker with .simage to convert it to an image.', mediaReply:'🖼️ Reply to an image or video first.',
    enabled:'Enabled ✅', disabled:'Disabled ✅', alreadyEnabled:'This feature is already enabled.', alreadyDisabled:'This feature is already disabled.',
    commandError:'❌ Something went wrong while executing the command.', failed:'❌ The operation failed. Try again later.', invalidNumber:'❌ Enter a valid number.', usage:'📌 Usage:'
  },
  identity: { name: 'Name', version: 'Version', developer: 'Developer' },
  chatbot:{ invalid:'❌ Invalid command. Use `.chatbot` to see how to use it.', setup:'*Chatbot setup*\n\n`.chatbot on` — enable chatbot\n`.chatbot off` — disable it in this group', enabled:'Chatbot enabled for this group 🤖', disabled:'Chatbot disabled for this group.', alreadyEnabled:'Chatbot is already enabled.', alreadyDisabled:'Chatbot is already disabled.' },
  help:{ title:'Leo Bot Commands', general:'🌐 General', admin:'👮‍♂️ Group Management', owner:'🔐 Owner & System', media:'🎨 Media & Stickers', ai:'🤖 AI', games:'🎮 Games & Fun', download:'📥 Downloaders', footer:"Leonardo's Projects" },
  commandCategories: {
    sticker: '🎨 Stickers', audio: '🎵 Music & Audio', group: '⚙️ Group Settings', interaction: '💞 Interaction',
    basic: '🤖 Basic & Services', ai: '🤖 Artificial Intelligence', fun: '🎮 Games & Fun',
    media: '🎵 Music & Audio', economy: '💰 Economy', owner: '👑 Owner & Control',
    utility: '🧰 Tools & Info', game: '🎮 Games & Fun', download: '📥 Downloads',
    whatsapp: '🧰 Tools & Info', group: '⚙️ Group Settings', image: '🖼️ Images'
  },
  ai: {
    usage: '🤖 Write your question after the command.\nExample: `.gpt explain artificial intelligence briefly`',
    processing: '🤖 Thinking... give me a moment.',
    failed: '❌ I could not get a response from the AI provider right now. Please try again shortly.',
    imageUsage: '🎨 Provide an image prompt first.\nExample: `.imagine a beautiful sunset over mountains`',
    imageSearchUsage: '🔎 Provide an image search query.\nExample: `.image white cat`',
    imageSearchProcessing: '🔎 Searching for an image...',
    imageSearchNotFound: '❌ No suitable image was found for that search.',
    imageSearchCaption: '🖼️ Image search result\nTitle: {title}\nQuery: {query}',
    imageSearchFailed: '❌ I could not search for an image right now. Try again later.',
    imageProcessing: '🎨 Generating the image... give me a moment.',
    imageCaption: '🎨 Generated image\nPrompt: {prompt}',
    imageFailed: '❌ I could not generate the image right now. Try another prompt or try again later.',
    videoUsage: '🎬 Provide a video prompt first.\nExample: `.sora anime girl with short blue hair walking in the rain`',
    videoProcessing: '🎬 Generating the video... this may take a little while.',
    videoCaption: '🎬 Generated video\nPrompt: {prompt}',
    videoFailed: '❌ I could not generate the video right now. Try another prompt or try again later.',
    thinking: '🤔 Let me think about that...',
    confused: '😅 I got a little confused there. Try asking in another way.',
    identity: 'I am Leo, the AI assistant inside Leo Bot. 🤖',
  },

  news: { title: 'Latest News' },
  commands: {
    "moderationProtection": {
      "botKick": "🤖 Leo's account cannot be kicked.",
      "botBan": "🤖 Leo's account cannot be banned.",
      "botWarn": "🤖 Leo's account cannot be warned.",
      "ownerKick": "👑 The bot owner cannot be kicked.",
      "ownerBan": "👑 The bot owner cannot be banned.",
      "ownerWarn": "👑 The bot owner cannot be warned.",
      "protected": "🛡️ This protected member cannot be moderated."
    },

    "ban": {
      "botAdmin": "❌ Please make Leo an admin to use `.ban`.",
      "admins": "❌ `.ban` is for group admins only.",
      "ownerPrivate": "❌ `.ban` in private chat is for the owner or Sudo only.",
      "mention": "📌 Mention the user or reply to their message to ban them.",
      "self": "🤖 You cannot ban Leo.",
      "success": "🚫 Successfully banned @{user}.",
      "already": "⚠️ @{user} is already banned.",
      "failed": "❌ Failed to ban the user."
    },
    "unban": {
      "botAdmin": "❌ Please make Leo an admin to use `.unban`.",
      "admins": "❌ `.unban` is for group admins only.",
      "ownerPrivate": "❌ `.unban` in private chat is for the owner or Sudo only.",
      "mention": "📌 Mention the user or reply to their message to unban them.",
      "success": "✅ Successfully unbanned {user}.",
      "notBanned": "ℹ️ @{user} is not banned.",
      "failed": "❌ Failed to unban the user."
    },
    "kick": {
      "success": "👢 Successfully kicked {users}.",
      "failed": "❌ Failed to kick the user(s)."
    },
    "mute": {
      "admins": "❌ Only group admins can use mute.",
      "minutes": "🔇 The group has been muted for {minutes} minutes.",
      "muted": "🔇 The group has been muted.",
      "unmuted": "🔊 The group has been unmuted.",
      "error": "❌ An error occurred while muting/unmuting the group. Please try again."
    },
    "promote": {
      "failed": "❌ Failed to promote user(s)."
    },
    "demote": {
      "group": "❌ This command can only be used in groups.",
      "botAdmin": "❌ Please make Leo an admin first.",
      "admins": "❌ Only group admins can use demote.",
      "mention": "📌 Mention the user or reply to their message to demote them.",
      "rate": "⏳ Rate limit reached. Please try again in a few seconds.",
      "failed": "❌ Failed to demote user(s). Make sure Leo is an admin with sufficient permissions."
    },
    "warn": {
      "group": "❌ This command can only be used in groups.",
      "botAdmin": "❌ Please make Leo an admin first.",
      "admins": "❌ Only group admins can use warn.",
      "mention": "📌 Mention the user or reply to their message to warn them.",
      "failed": "❌ Failed to warn the user.",
      "rate": "⏳ Rate limit reached. Please try again in a few seconds."
    },
    "warnings": {
      "count": "⚠️ The user has {count} warning(s)."
    },
    "tagall": {
      "admins": "❌ Only group admins can use `.tagall`.",
      "empty": "❌ No participants found in the group.",
      "failed": "❌ Failed to tag all members.",
      "header": "🔊 *Hello everyone:*"
    },
    "delete": {
      "botAdmin": "❌ I need to be an admin to delete messages.",
      "admins": "❌ Only admins can use `.delete`.",
      "usage": "❌ Please specify the number of messages to delete.\n\nUsage:\n• `.del 5` — Delete the last 5 group messages\n• `.del 3 @user` — Delete the last 3 messages from @user\n• `.del 2` (reply to a message) — Delete the last 2 messages from its sender",
      "emptyGroup": "❌ No recent messages found in the group to delete.",
      "emptyUser": "❌ No recent messages found for the target user.",
      "failed": "❌ Failed to delete messages."
    },
    "groupinfo": {
      "failed": "❌ Failed to get group info.",
      "noDescription": "No description"
    }
  },

  moderation: {
    admins: '❌ This command is available to group admins only.',
    antibadwordError: '❌ Error while processing bad-word protection.',
    antilinkError: '❌ Error while processing link protection.',
    antitagError: '❌ Error while processing mention protection.',
    hidetagAdmins: '❌ `.hidetag` is for group admins only.'
  },
  antilink: {
    usage: '```Link Protection Setup\n\n{prefix}antilink on\n{prefix}antilink set delete | kick | warn\n{prefix}antilink off\n```',
    alreadyOn: '⚠️ Link protection is already enabled.', turnedOn: '🛡️ Link protection enabled.', turnOnFailed: '❌ Failed to enable link protection.',
    turnedOff: '🛡️ Link protection disabled.', setUsage: '📌 Specify an action: {prefix}antilink set delete | kick | warn',
    invalidAction: '❌ Invalid action. Choose delete, kick, or warn.', actionSet: '✅ Link protection action set to: {action}',
    actionFailed: '❌ Failed to set link protection action.', status: '🛡️ *Link Protection Settings*\nStatus: {status}\nAction: {action}', useHelp: '📌 Use {prefix}antilink to view usage.'
  },
  antitag: {
    usage: '```Mention Protection Setup\n\n{prefix}antitag on\n{prefix}antitag set delete | kick\n{prefix}antitag off\n```',
    alreadyOn: '⚠️ Mention protection is already enabled.', turnedOn: '🛡️ Mention protection enabled.', turnOnFailed: '❌ Failed to enable mention protection.',
    turnedOff: '🛡️ Mention protection disabled.', setUsage: '📌 Specify an action: {prefix}antitag set delete | kick',
    invalidAction: '❌ Invalid action. Choose delete or kick.', actionSet: '✅ Mention protection action set to: {action}',
    actionFailed: '❌ Failed to set mention protection action.', status: '🛡️ *Mention Protection Settings*\nStatus: {status}\nAction: {action}', useHelp: '📌 Use {prefix}antitag to view usage.'
  },
  resetlink: { success: '✅ Group link reset successfully.\n\n📌 New link:\n{link}', failed: '❌ Failed to reset the group link.' },
  tag: { header: '🔊 *Hello everyone:*', noNonAdmins: '❌ No non-admin members to tag.', failed: '❌ Failed to tag non-admin members.' },
  group: { usageDesc: '📌 Usage: .setgdesc <description>', descUpdated: '✅ Group description updated.', descFailed: '❌ Failed to update group description.', usageName: '📌 Usage: .setgname <new name>', nameUpdated: '✅ Group name updated.', nameFailed: '❌ Failed to update group name.', usagePhoto: '📌 Reply to an image/sticker with `.setgpp`.', photoUpdated: '✅ Group profile photo updated.', photoFailed: '❌ Failed to update group profile photo.' },
  owner: { only: '❌ This command is available to the owner only.' },
  media: {
    common: { downloadFailed: '❌ Failed to download media. Please try again.' },
    sticker: { usage: '📌 Reply to an image/video with `.sticker`, or send media with the command.', failed: '❌ Failed to create the sticker. Please try again.' },
    crop: { usage: '📌 Reply to an image/video/sticker with `.crop`.', failed: '❌ Failed to crop the sticker. Try an image.' },
    telegram: { usage: '⚠️ Please enter the Telegram sticker URL.\n\nExample: `.tg https://t.me/addstickers/Porcientoreal`', invalid: '❌ Invalid URL. Make sure it is a Telegram sticker pack URL.', failed: '❌ Failed to process Telegram stickers. Check that the URL is correct and the pack is public.' },
    take: { usage: '❌ Reply to a sticker with `.take <packname>`', downloadFailed: '❌ Failed to download the sticker.', failed: '❌ An error occurred while processing the sticker.' },
    gif: { termRequired: '📌 Please provide a search term for the GIF.', notFound: '❌ No GIFs found for your search term.', failed: '❌ Failed to fetch the GIF. Please try again later.' },
    attp: { textRequired: '📌 Please provide text after `.attp`.', failed: '❌ Failed to generate the sticker.' },
    blur: { replyImage: '❌ Please reply to an image.', usage: '❌ Please reply to an image or send an image with `.blur`.', success: '✅ Image blurred successfully.', failed: '❌ Failed to blur the image. Please try again later.' },
    remini: { invalidUrl: '❌ Invalid URL.\n\nUsage: `.remini https://example.com/image.jpg`', usage: '📸 *Image enhancement*\n\nUsage:\n• `.تحسين <image_url>`\n• Reply to an image with `.تحسين`\n• Send an image with `.تحسين`', success: '✨ *Image enhanced successfully!*' },
    removebg: { invalidUrl: '❌ Invalid URL.\n\nUsage: `.removebg https://example.com/image.jpg`', usage: '📸 *Remove Image Background*\n\nUsage:\n• `.removebg <image_url>`\n• Reply to an image with `.removebg`\n• Send an image with `.removebg`', success: '✨ *Background removed successfully!*\n\nLeonardo\'s Projects' },
    setpp: { replyImage: '⚠️ Please reply to an image with `.setpp`.', imageRequired: '❌ The replied message must contain an image.', success: '✅ Bot profile picture updated successfully.', failed: '❌ Failed to update the bot profile picture.' },
    simage: { usage: '📌 Reply to a sticker with `.simage` to convert it to an image.', success: '🖼️ Here is the converted image.', failed: '❌ An error occurred while converting the sticker to an image.' },
    screenshot: { invalidUrl: '❌ Please provide a valid URL starting with http:// or https://.', failed: '❌ Failed to take the screenshot. Please try again in a few minutes.' },
    viewonce: { usage: '❌ Please reply to a view-once image or video.' },
    url: { usage: '📎 Send or reply to media (image, video, audio, sticker, document) to get a URL.', uploadFailed: '❌ Failed to upload media.', failed: '❌ Failed to convert media to a URL.' },
    translate: { noText: '❌ No text found to translate. Please provide text or reply to a message.', failed: '❌ Failed to translate text. Please try again later.' },
    textmaker: { textRequired: '📌 Please provide text to generate.\nExample: `.metallic Nick`', invalidType: '❌ Invalid text generator type.' }
  },


  games: {
    trivia: { already: '🎮 A trivia game is already in progress.', question: '🧠 Trivia Time!\n\nQuestion: {question}\nOptions:\n{options}', error: '❌ Failed to fetch a trivia question. Try again later.', none: '❌ No trivia game is in progress.', correct: '✅ Correct! The answer is: {answer}', wrong: '❌ Wrong answer! The correct answer is: {answer}' },
    hangman: { started: '🎯 Game started! The word: {word}', none: '❌ No game in progress. Start with `.hangman`.', repeated: '🔤 You already guessed `{letter}`. Try another letter.', good: '✅ Good guess! {word}', won: '🎉 Congratulations! You guessed: {answer}', wrong: '❌ Wrong guess! You have {tries} tries left.', lost: '💀 Game over! The word was: {answer}' },
    common: { failed: '❌ Failed to fetch content right now. Try again later.', tryAgain: '⏳ Please try again in a moment.' },
    mention: '📌 Mention someone or reply to their message first.',
    ship: '💖 Compatibility between {first} and {second}: {percent}%\nGood luck, you two! 😄',
  },
  fun: { fact: '🧠 I could not fetch a fact right now. Try again later.', quote: '💬 I could not fetch a quote right now. Try again later.', truth: '🎲 I could not fetch a truth question right now. Try again later.', dare: '🎲 I could not fetch a dare right now. Try again later.', shayari: '✍️ I could not fetch shayari right now. Try again later.' },

  language:{ title:'🌐 Language', current:'Current language: English', usage:'Usage: .language ar or .language en', changed:'Bot language changed to English 🇬🇧', invalid:'❌ Available languages: ar or en.' },

  download: {
    common: { notFound: '❌ No suitable result was found.' },
    play: { usage: '📌 Usage: .play <song name>', notFound: '❌ I could not find that song.', downloading: '⏳ Downloading: *{title}*', failed: '❌ Failed to download the song.' },
    song: { usage: '📌 Usage: .song <song name or YouTube URL>', downloading: '⏳ Downloading: *{title}*', failed: '❌ The download could not be completed right now. Try again later.' },
    video: { usage: '📌 Usage: .video <video name or YouTube URL>', downloading: '⏳ Downloading: *{title}*', caption: '📥 {title}', defaultTitle: 'YouTube Video', failed: '❌ The download could not be completed right now. Try again later.' },
    tiktok: { invalidUrl: '📌 Send a valid TikTok URL.', caption: '🎵 {title}', defaultTitle: 'TikTok Video', failed: '❌ The download could not be completed right now. Try again later.' },
    instagram: { invalidUrl: '📌 Send a valid Instagram URL (post or Reel).', caption: '📥 Instagram', failed: '❌ The download could not be completed right now. Try again later.' },
    facebook: { invalidUrl: '📌 Send a valid Facebook URL.', caption: '📘 {title}', defaultTitle: 'Facebook Video', failed: '❌ The download could not be completed right now. Try again later.' },
    spotify: { usage: '📌 Usage: .spotify <song/artist>', caption: '📥 {title}', failed: '❌ The download could not be completed right now. Try again later.' }
  },

};
