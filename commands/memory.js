const fs = require("fs");
const path = require("path");
const { EmbedBuilder } = require("discord.js");

const filePath = path.join(__dirname, "..", "data", "memory.json");

function readMemory() {
  if (!fs.existsSync(filePath)) return {};
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return {};
  }
}

function saveMemory(memories) {
  fs.writeFileSync(filePath, JSON.stringify(memories, null, 2));
}

function createEmbed({
  title,
  description,
  color = 0x3498db,
  footer,
  timestamp = true,
}) {
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(color);
  if (footer) embed.setFooter({ text: footer });
  if (timestamp) embed.setTimestamp();
  return embed;
}

function memoryListEmbed(user, list) {
  if (!list || list.length === 0) {
    return createEmbed({
      title: "📭 Aucun souvenir enregistré",
      description: "Ajoute ton premier souvenir avec :\n`!memory add <texte>`",
      color: 0x95a5a6,
    });
  }

  if (list.length === 1) {
    return createEmbed({
      title: `📚 Souvenir unique de ${user.username}`,
      description: list[0],
      color: 0x3498db,
      footer: "1 souvenir",
    });
  }

  return createEmbed({
    title: `📚 Souvenirs de ${user.username}`,
    description: list.map((m, i) => `**${i + 1}.** ${m}`).join("\n"),
    color: 0x3498db,
    footer: `Total : ${list.length} souvenirs`,
  });
}

module.exports = {
  name: "memory",
  description: "Gère tes souvenirs personnels",
  execute(message, args) {
    const memories = readMemory();
    const userId = message.author.id;

    if (!memories[userId]) memories[userId] = [];

    if (args.length === 0) {
      return message.channel.send({
        embeds: [
          createEmbed({
            title: "❓ Commande Memory",
            description: [
              "**Utilisation :**",
              "`!memory add <texte>` → Ajouter un souvenir",
              "`!memory list` → Voir tes souvenirs",
              "`!memory del <num>` → Supprimer un souvenir",
            ].join("\n"),
            color: 0xf1c40f,
            footer: `Demandé par ${message.author.tag}`,
          }),
        ],
      });
    }

    const subcommand = args.shift().toLowerCase();

    switch (subcommand) {
      case "add": {
        const text = args.join(" ").trim();
        if (!text) {
          return message.channel.send({
            embeds: [
              createEmbed({
                title: "⚠️ Erreur",
                description:
                  "Merci de préciser un souvenir à enregistrer.\n\n**Exemple :** `!memory add Mon premier concert`",
                color: 0xe74c3c,
              }),
            ],
          });
        }
        memories[userId].push(text);
        saveMemory(memories);

        return message.channel.send({
          embeds: [
            createEmbed({
              title: "💾 Souvenir ajouté",
              description: `"${text}"`,
              color: 0x2ecc71,
              footer: `Ajouté par ${message.author.tag}`,
            }),
          ],
        });
      }

      case "list":
        return message.channel.send({
          embeds: [memoryListEmbed(message.author, memories[userId])],
        });

      case "del": {
        const num = parseInt(args[0], 10);
        const list = memories[userId];
        if (isNaN(num) || num < 1 || num > list.length) {
          return message.channel.send({
            embeds: [
              createEmbed({
                title: "⚠️ Numéro invalide",
                description: [
                  "Merci d’indiquer un numéro valide correspondant à un souvenir existant.",
                  "**Exemple :** `!memory del 2`",
                  `Tu as actuellement **${list.length}** souvenir(s).`,
                ].join("\n"),
                color: 0xe74c3c,
              }),
            ],
          });
        }

        const [removed] = list.splice(num - 1, 1);
        saveMemory(memories);

        return message.channel.send({
          embeds: [
            createEmbed({
              title: "🗑️ Souvenir supprimé",
              description: `"${removed}"`,
              color: 0xe74c3c,
              footer: `Supprimé par ${message.author.tag}`,
            }),
          ],
        });
      }

      default:
        return message.channel.send({
          embeds: [
            createEmbed({
              title: "❌ Commande inconnue",
              description: [
                "Sous-commandes disponibles :",
                "`add <texte>` → Ajouter un souvenir",
                "`list` → Voir tes souvenirs",
                "`del <num>` → Supprimer un souvenir",
              ].join("\n"),
              color: 0xe67e22,
              footer: `Demandé par ${message.author.tag}`,
            }),
          ],
        });
    }
  },

  listMemories: (user) => {
    const memories = readMemory();
    return memoryListEmbed(user, memories[user.id] || []);
  },
};
