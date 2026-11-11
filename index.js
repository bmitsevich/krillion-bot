require('dotenv').config(); 
const { Client, GatewayIntentBits } = require('discord.js');
const cron = require('node-cron');

// --- CONFIGURATION ---
const BOT_TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_IDS = ['1566828006893297754', '1566885606838108340'];
const ENTRY_REGEX = /^Krillion[^\r\n]*\r?\n\s*(\d{1,3})(?!\d)/i;
// ---------------------

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}! Waiting for 9:00 AM...`);

  // Schedule task to run at 9:00 AM every day
  cron.schedule('00 17 * * *', () => {
    findDailyWinner();
  });
});

async function findDailyWinner() {
  for (const channelId of CHANNEL_IDS) {
    try {
      const channel = await client.channels.fetch(channelId);
      if (!channel) {
        console.error(`Channel not found: ${channelId}`);
        continue;
      }
      console.log(`Fetched channel: ${channel.name}`);

      // Calculate timestamps for the previous day (00:00:00 yesterday to 00:00:00 today)
      const endOfYesterday = new Date();
      endOfYesterday.setHours(0, 0, 0, 0);

      const startOfYesterday = new Date(endOfYesterday);
      startOfYesterday.setDate(startOfYesterday.getDate() - 1);

      let highestScore = -Infinity;
      let winningUser = null;
      let lastMessageId = null;
      let keepFetching = true;
      let lowestScore = Infinity;
      let lowestScoreUser = null;

      // Loop through message history in batches of 100
      while (keepFetching) {
        const options = { limit: 100 };
        if (lastMessageId) options.before = lastMessageId;

        const messages = await channel.messages.fetch(options);
        if (messages.size === 0) break;

        for (const message of messages.values()) {
          // Stop searching once we reach messages older than yesterday
          if (message.createdTimestamp < startOfYesterday.getTime()) {
            keepFetching = false;
            break;
          }

          // Ignore bots and messages sent after midnight today
          if (message.author.bot || message.createdTimestamp >= endOfYesterday.getTime()) {
            continue;
          }

          // Capture the 1-3 digit score following the entry marker
          const match = message.content.match(ENTRY_REGEX);
          if (match) {
            console.log(`Found entry from ${message.author.tag}: ${match[1]}`);
            const score = Number(match[1]);

            if (score > highestScore) {
              highestScore = score;
              winningUser = message.author;
            }

            if (score < lowestScore) {
              lowestScore = score;
              lowestScoreUser = message.author;
            }
          }
        }

        lastMessageId = messages.last()?.id;
      }

      // Announce the results
      if (winningUser) {
        await channel.send(
          `🎉 **Daily Winner!** Congratulations <@${winningUser.id}> for being the nichest fella yesterday, with a depth of **${highestScore}**!`
        );
      }
      if (lowestScoreUser) {
        await channel.send(
          `😢 **Daily Loser!** Better luck next time, <@${lowestScoreUser.id}> basic as hell with a depth of **${lowestScore}**!`
        );
      }
    } catch (error) {
      console.error(`Error finding winner in channel ${channelId}:`, error);
    }
  }
}

client.login(BOT_TOKEN);
