require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Client, GatewayIntentBits, Collection } = require("discord.js");
const cron = require("node-cron");
const config = require("./config.json");

const { sendCallnotesCron } = require("./commands/callnote");
const { sendCalendarCron } = require("./commands/calendar");
const { sendNotesCron } = require("./commands/note");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const prefix = config.prefix || "!";
client.commands = new Collection();

// --- Import des commandes ---
const commandsPath = path.join(__dirname, "commands");
fs.readdirSync(commandsPath)
  .filter((f) => f.endsWith(".js"))
  .forEach((file) => {
    const cmd = require(path.join(commandsPath, file));
    if (cmd?.name && typeof cmd.execute === "function")
      client.commands.set(cmd.name, cmd);
  });

// --- Fonction utilitaire pour envoyer un embed ---
async function sendEmbed(channelId, embed) {
  if (!channelId) return;
  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel) return;
    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error(
      `Erreur en envoyant un embed sur le channel ${channelId}:`,
      err,
    );
  }
}

// --- Ready ---
client.once("ready", () => {
  console.log(`Connecté en tant que ${client.user.tag}`);

  if (!config.reminderChannelId)
    console.warn("⚠️ reminderChannelId non configuré.");

  cron.schedule("0 20 * * *", () => sendCallnotesCron(client), {
    timezone: "Europe/Paris",
  });
  cron.schedule("0 18 * * *", () => sendNotesCron(client), {
    timezone: "Europe/Paris",
  });
  cron.schedule("0 10 * * *", () => sendCalendarCron(client), {
    timezone: "Europe/Paris",
  });
});

// --- Message handler ---
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  const content = message.content.trim();
  if (/^meow$/i.test(content)) {
    return message.channel.send("meow");
  }

  if (!content.startsWith(prefix)) return;

  const args = content.slice(prefix.length).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();

  const command = client.commands.get(commandName);
  if (!command) return;

  try {
    await command.execute(message, args);
  } catch (err) {
    console.error("Erreur exécution commande:", err);
    await message.reply(
      "❌ Une erreur est survenue lors de l’exécution de la commande.",
    );
  }
});

// --- Login avec retry ---
let retryCount = 0;
const maxRetries = 5;

function startBot() {
  client
    .login(process.env.DISCORD_TOKEN)
    .then(() => {
      retryCount = 0;
      console.log("✅ Bot connecté avec succès");
    })
    .catch((err) => {
      if (
        err.code === "EAI_AGAIN" ||
        (err.message && err.message.includes("getaddrinfo EAI_AGAIN"))
      ) {
        console.error("Erreur réseau : Impossible de joindre Discord.");
        retryCount++;
        if (retryCount <= maxRetries) {
          console.log(`Retry ${retryCount} dans 2 secondes...`);
          setTimeout(startBot, 2000);
        } else {
          console.error("Nombre maximum de retries atteint, arrêt du bot.");
          process.exit(1);
        }
      } else {
        console.error("Erreur login:", err);
        process.exit(1);
      }
    });
}

startBot();
