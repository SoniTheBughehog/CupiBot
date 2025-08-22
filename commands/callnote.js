const fs = require("fs");
const path = require("path");
const { EmbedBuilder } = require("discord.js");
const { sendEmbed } = require("../utils/sendEmbed");
const config = require("../config.json");

const filePath = path.join(__dirname, "..", "data", "callnote.json");

function readCalls() {
  if (!fs.existsSync(filePath)) return [];
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return [];
  }
}

function saveCalls(calls) {
  fs.writeFileSync(filePath, JSON.stringify(calls, null, 2));
}

function createEmbed({
  title,
  description,
  color = 0x9c27b0,
  fields = [],
  footer,
  timestamp = true,
}) {
  const embed = new EmbedBuilder().setColor(color).setTitle(title);
  if (description) embed.setDescription(description);
  if (fields.length) embed.addFields(fields);
  if (footer) embed.setFooter({ text: footer });
  if (timestamp) embed.setTimestamp();
  return embed;
}

function usageEmbed(prefix, user) {
  return createEmbed({
    title: "⚠️ Utilisation de la commande",
    color: 0xff9800,
    description: [
      `**${prefix}callnote add <qui> <sujet>** → Ajouter un sujet`,
      `**${prefix}callnote list** → Voir la liste`,
      `**${prefix}callnote del <num>** → Supprimer un sujet`,
    ].join("\n"),
    footer: `Demandé par ${user.tag}`,
  });
}

function errorEmbed(title, description, user) {
  return createEmbed({
    title,
    description,
    color: 0xf44336,
    footer: `Demandé par ${user.tag}`,
  });
}

function listCallsEmbed(calls, user) {
  if (!calls.length) {
    return createEmbed({
      title: "📭 Liste vide",
      description: "Aucun sujet n’a encore été ajouté.",
      color: 0x9e9e9e,
      footer: `Demandé par ${user.tag}`,
    });
  }

  if (calls.length === 1) {
    const c = calls[0];
    return createEmbed({
      title: `📞 Sujet unique à traiter`,
      description: `Pour **${c.qui}** : ${c.sujet}\n*(ajouté par ${c.addedBy})*`,
      color: 0xba68c8,
      footer: `Demandé par ${user.tag}`,
    });
  }

  return createEmbed({
    title: "📋 Liste des sujets",
    description: calls
      .map((c, i) => `**${i + 1}.** [${c.qui}] ${c.sujet} _(par ${c.addedBy})_`)
      .join("\n"),
    color: 0xba68c8,
    footer: `Demandé par ${user.tag}`,
  });
}

module.exports = {
  name: "callnote",
  description: "Gérer la liste des sujets pour un appel",
  async execute(message, args) {
    const prefix = "!";
    const calls = readCalls();

    if (!args.length) {
      await message.channel.send({
        embeds: [usageEmbed(prefix, message.author)],
      });
      return;
    }

    const subcommand = args.shift().toLowerCase();

    switch (subcommand) {
      case "add": {
        if (args.length < 2) {
          await message.channel.send({
            embeds: [usageEmbed(prefix, message.author)],
          });
          return;
        }
        const qui = args.shift();
        const sujet = args.join(" ");
        calls.push({ qui, sujet, addedBy: message.author.tag });
        saveCalls(calls);

        const embed = createEmbed({
          title: "✅ Sujet ajouté",
          color: 0x4caf50,
          fields: [
            { name: "Pour", value: qui, inline: true },
            { name: "Sujet", value: sujet, inline: true },
            { name: "Ajouté par", value: message.author.tag, inline: false },
          ],
        });

        await message.channel.send({ embeds: [embed] });
        break;
      }
      case "list": {
        await message.channel.send({
          embeds: [listCallsEmbed(calls, message.author)],
        });
        break;
      }
      case "del": {
        const num = parseInt(args[0], 10);
        if (isNaN(num) || num < 1 || num > calls.length) {
          await message.channel.send({
            embeds: [
              errorEmbed(
                "❌ Erreur",
                "Numéro invalide. Vérifie avec `!callnote list`.",
                message.author,
              ),
            ],
          });
          return;
        }

        const [removed] = calls.splice(num - 1, 1);
        saveCalls(calls);

        const embed = createEmbed({
          title: "🗑️ Sujet supprimé",
          color: 0xf44336,
          fields: [
            { name: "Pour", value: removed.qui, inline: true },
            { name: "Sujet", value: removed.sujet, inline: true },
          ],
          footer: `Supprimé par ${message.author.tag}`,
        });

        await message.channel.send({ embeds: [embed] });
        break;
      }
      default: {
        const embed = createEmbed({
          title: "❓ Commande inconnue",
          color: 0xff5722,
          description: `La sous-commande \`${subcommand}\` n’existe pas.`,
          fields: [
            { name: "Commandes disponibles", value: "`add`, `list`, `del`" },
          ],
          footer: `Demandé par ${message.author.tag}`,
        });

        await message.channel.send({ embeds: [embed] });
      }
    }
  },
  listCalls: (user) => {
    const calls = readCalls();
    return listCallsEmbed(calls, user);
  },

  async sendCallnotesCron(client) {
    if (!config.reminderChannelId) return;
    const embed = listCalls({ username: "Appel" });
    await sendEmbed(config.reminderChannelId, embed, client);
  },
};
