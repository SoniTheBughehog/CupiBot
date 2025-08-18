require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Collection, EmbedBuilder } = require('discord.js');
const cron = require('node-cron');
const config = require('./config.json');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.commands = new Collection();
const prefix = config.prefix || '!';

// --- Utils JSON ---
function utilsReadJSON(file) {
  try {
    if (!fs.existsSync(file)) return null;
    const data = fs.readFileSync(file, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error(`Erreur lecture JSON (${file}):`, err);
    return null;
  }
}

// --- Charger les commandes ---
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));
for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
const { getCalendarEmbed } = require('./calendar.js');
  if (command?.name && typeof command.execute === 'function') {
    client.commands.set(command.name, command);
  } else {
    console.warn(`Commande ignorée (structure invalide): ${file}`);
  }
}

// --- Fonctions pour cron ---
async function sendCallnotes() {
  if (!config.reminderChannelId) return;
  const calls = utilsReadJSON(path.join(__dirname, 'data', 'callnote.json'));
  if (!Array.isArray(calls) || calls.length === 0) return;

  try {
    const channel = await client.channels.fetch(config.reminderChannelId);
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setColor('#2196f3')
      .setTitle('📋 Liste des sujets pour l’appel')
      .setDescription(
        calls.map((c, i) => `**${i + 1}.** [${c.qui}] ${c.sujet} _(par ${c.addedBy})_`).join('\n')
      )
      .setTimestamp();

    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error('Erreur en envoyant les callnotes:', err);
  }
}

async function sendNotes() {
  const data = utilsReadJSON(path.join(__dirname, 'data', 'note.json'));
  if (!data || typeof data !== 'object') return;

  for (const [userId, userData] of Object.entries(data)) {
    if (!userData.channelId || !Array.isArray(userData.notes) || userData.notes.length === 0) continue;

    try {
      const channel = await client.channels.fetch(userData.channelId);
      const user = await client.users.fetch(userId);
      if (!channel) continue;

      const embed = new EmbedBuilder()
        .setColor('#9c27b0')
        .setTitle(`📋 Notes de ${user?.username || 'Utilisateur'}`)
        .setDescription(
          userData.notes.map((n, i) => `**${i + 1}.** ${n.sujet}`).join('\n')
        );

      await channel.send({ embeds: [embed] });
    } catch (err) {
      console.error(`Erreur pour user ${userId}:`, err);
    }
  }
}

async function sendCalendar() {
  const calendar = utilsReadJSON(path.join(__dirname, 'data', 'calendar.json'));
  if (!Array.isArray(calendar)) return;

  try {
    const channel = await client.channels.fetch(config.reminderChannelId);
    if (!channel) return;

    const embed = getCalendarEmbed(calendar);
    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error('Erreur en envoyant le calendrier:', err);
  }
}

// --- Ready ---
client.once('ready', () => {
  console.log(`Connecté en tant que ${client.user.tag}`);

  cron.schedule('0 22 * * *', sendCallnotes, { timezone: 'Europe/Paris' });
  cron.schedule('0 18 * * *', sendNotes, { timezone: 'Europe/Paris' });
  cron.schedule('0 10 * * *', sendCalendar, { timezone: 'Europe/Paris' });
});

// --- Messages ---
client.on('messageCreate', async message => {
  if (message.author.bot) return;

  if (/\b(meow|miaou)\b/i.test(message.content)) {
    await message.channel.send('meow');
    return;
  }

  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();

  const command = client.commands.get(commandName);
  if (!command) return;

  try {
    await command.execute(message, args);
  } catch (err) {
    console.error('Erreur exécution commande:', err);
    await message.reply('❌ Une erreur est survenue lors de l’exécution de la commande.');
  }
});

// --- Login avec retry ---
let retryCount = 0;
const maxRetries = 5;

function startBot() {
  client.login(process.env.DISCORD_TOKEN)
    .then(() => { retryCount = 0; })
    .catch(err => {
      if (err.code === 'EAI_AGAIN' || (err.message && err.message.includes('getaddrinfo EAI_AGAIN'))) {
        console.error('Erreur réseau : Impossible de joindre Discord.');
        retryCount++;
        if (retryCount <= maxRetries) {
          console.log(`Retry ${retryCount} dans 2 secondes...`);
          setTimeout(startBot, 2000);
        } else {
          console.error('Nombre maximum de retries atteint, arrêt du bot.');
          process.exit(1);
        }
      } else {
        console.error('Erreur login:', err);
        process.exit(1);
      }
    });
}

startBot();
